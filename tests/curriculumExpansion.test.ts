import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { combineUnits, fiveQuestionLearningUnits as learningUnits, legacyLessonIds, previousLearningUnits, previousLessonIds } from '../src/data/lessons.ts';
import { validCompletedIds } from '../src/lib/learningProgress.ts';
import { decodeSnapshot } from '../src/lib/backendDecoders.ts';
import { answersFor } from './learningFixtures.ts';
const initialUnit = combineUnits(learningUnits);

test('expanded curriculum keeps historical profiles, receipts, pending lessons and import validation', async t => {
  const db = await PGlite.create(); t.after(() => db.close());
  await db.exec(`create role anon nologin; create role authenticated nologin;
    create schema auth; create table auth.users(id uuid primary key,raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated;`);
  for (const name of ['202610050001_auth_profiles.sql','202610060001_learning_schema.sql','202610060002_learning_functions.sql','202610060003_leaderboard.sql','202610060004_learning_journey.sql','202610070001_varied_exercises.sql']) {
    await db.exec(await readFile(new URL('../supabase/migrations/' + name, import.meta.url), 'utf8'));
  }
  const previous = combineUnits(previousLearningUnits);
  const users = ['00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000005'];
  for (const id of users) await db.query("insert into auth.users values($1,'{}')", [id]);
  const asUser = <T>(id: string, operation: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<T>) => db.transaction(async tx => {
    await tx.exec('set local role authenticated'); await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [id]); return operation(tx);
  });
  const complete = (owner: string, lesson: typeof initialUnit.lessons[number], attempt: string) => asUser(owner, async tx =>
    (await tx.query<{value: {result: {xpEarned: number}}}>('select public.complete_learning_lesson($1,$2::jsonb,$3) value', [lesson.id, JSON.stringify(answersFor(lesson)), attempt])).rows[0]!.value);
  for (const [index, lesson] of previous.lessons.entries()) {
    await complete(users[0]!, lesson, `old-${index}`);
    if (index < 7) await complete(users[1]!, lesson, `pending-${index}`);
  }
  await db.query("update profiles set avatar_key='owl' where id=$1", [users[0]]);
  const tracked = ['profiles','user_lesson_progress','lesson_attempts','xp_events','user_daily_activity'];
  const before = await Promise.all(tracked.map(table => db.query(`select * from ${table} order by id`)));
  const activeBefore = (await db.query('select * from questions where order_index<1000 order by id')).rows;
  await db.exec(await readFile(new URL('../supabase/migrations/202610080001_expanded_curriculum.sql', import.meta.url), 'utf8'));
  for (const [index, table] of tracked.entries()) assert.deepEqual((await db.query(`select * from ${table} order by id`)).rows, before[index]!.rows);
  const oldIds = activeBefore.map(row => row.id);
  assert.deepEqual((await db.query('select * from questions where id=any($1::text[]) order by id', [oldIds])).rows, activeBefore);
  const snapshot = await asUser(users[0]!, async tx => (await tx.query<{value: unknown}>('select public.learning_snapshot() value')).rows[0]!.value);
  const restored = decodeSnapshot(snapshot, users[0]!, initialUnit);
  assert.equal(restored.progress.xp, 200);
  assert.equal(restored.profile.avatar_key, 'owl');
  assert.deepEqual(new Set(restored.progress.completedLessonIds), new Set(previousLessonIds));
  assert.equal(restored.progress.currentUnitId, learningUnits[0]!.id);
  assert.equal((await complete(users[0]!, initialUnit.lessons[4]!, 'first-addition')).result.xpEarned, 25);
  assert.equal((await complete(users[0]!, previous.lessons[7]!, 'review-after-expansion')).result.xpEarned, 0);
  assert.equal((await complete(users[1]!, previous.lessons[7]!, 'queued-before-expansion')).result.xpEarned, 25);
  await assert.rejects(complete(users[2]!, learningUnits[1]!.lessons[0]!, 'fresh-locked'), /lesson_locked/);
  await assert.rejects(complete(users[0]!, learningUnits[2]!.lessons[0]!, 'skip-additions'), /lesson_locked/);
  // Entire old route queued while offline, without a server-side started row.
  for (const lesson of previous.lessons) assert.equal((await complete(users[4]!,lesson,'offline-'+lesson.id)).result.xpEarned,25);
  const fresh='00000000-0000-4000-8000-000000000006';
  await db.query("insert into auth.users values($1,'{}')",[fresh]);
  for (const lesson of previousLearningUnits[0]!.lessons) await complete(fresh,lesson,'new-'+lesson.id);
  await assert.rejects(complete(fresh,previousLearningUnits[1]!.lessons[0]!,'new-cannot-skip'),/lesson_locked/);

  const cases: string[][] = [];
  for (let n = 0; n <= 100; n++) cases.push(initialUnit.lessons.slice(0,n).map(lesson => lesson.id));
  for (const history of [legacyLessonIds,previousLessonIds]) for (let n = 1; n <= history.length; n++) {
    const baseline = history.slice(0,n);
    const remaining = initialUnit.lessons.filter(lesson => !baseline.includes(lesson.id));
    for (const added of [0,1,6,25]) cases.push([...baseline,...remaining.slice(0,added).map(lesson => lesson.id)]);
  }
  cases.push(['unknown'], [initialUnit.lessons[1]!.id], [initialUnit.lessons[0]!.id, initialUnit.lessons[0]!.id], [...previousLessonIds, initialUnit.lessons[5]!.id]);
  for (const ids of cases) {
    const sql = (await db.query<{valid: boolean}>('select public.valid_learning_completion_ids($1::jsonb) valid', [JSON.stringify(ids)])).rows[0]!.valid;
    assert.equal(sql, validCompletedIds(ids,initialUnit), JSON.stringify(ids));
  }
  const ids = [...previousLessonIds, initialUnit.lessons[4]!.id];
  const imported = await asUser(users[3]!, async tx => (await tx.query<{value: unknown}>('select public.import_guest_progress($1,$2::jsonb,$3) value', ['old-with-new',JSON.stringify(ids),225])).rows[0]!.value);
  assert.equal(decodeSnapshot(imported,users[3]!,initialUnit).progress.xp,225);
  assert.deepEqual(new Set(decodeSnapshot(imported,users[3]!,initialUnit).progress.completedLessonIds),new Set(ids));
  await asUser(users[2]!, async tx => { await assert.rejects(tx.exec("select public.valid_learning_completion_ids('[]')"), /permission denied/); });
});
