import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { combineUnits, fiveQuestionLearningUnits, initialUnit } from '../src/data/lessons.ts';
import { answersFor } from './learningFixtures.ts';

test('ten-question migration retains five-question receipts/avatars/XP and accepts old offline submissions', async t => {
  const db = await PGlite.create(); t.after(() => db.close());
  await db.exec(`create role anon nologin; create role authenticated nologin;
    create schema auth; create table auth.users(id uuid primary key, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated;`);
  for (const file of ['202610050001_auth_profiles.sql','202610060001_learning_schema.sql','202610060002_learning_functions.sql','202610060003_leaderboard.sql','202610060004_learning_journey.sql','202610070001_varied_exercises.sql','202610080001_expanded_curriculum.sql']) await db.exec(await readFile(new URL('../supabase/migrations/' + file, import.meta.url), 'utf8'));
  const user = '00000000-0000-4000-8000-000000000001';
  await db.query("insert into auth.users values($1,'{}')", [user]);
  await db.query("update profiles set avatar_key='owl' where id=$1", [user]);
  const complete = (lesson: typeof initialUnit.lessons[number], id: string, answers = answersFor(lesson)) => db.transaction(async tx => {
    await tx.exec('set local role authenticated'); await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [user]);
    return (await tx.query<{ value: { result: { correct: number; total: number; xpEarned: number } } }>('select public.complete_learning_lesson($1,$2::jsonb,$3) value', [lesson.id, JSON.stringify(answers), id])).rows[0]!.value;
  });
  const old = combineUnits(fiveQuestionLearningUnits);
  const receipt = await complete(old.lessons[0]!, 'before-upgrade');
  assert.equal(receipt.result.xpEarned, 25);
  const tables = ['profiles', 'user_lesson_progress', 'lesson_attempts', 'xp_events', 'user_daily_activity'];
  const before = await Promise.all(tables.map(table => db.query(`select * from ${table} order by id`)));
  const questions = (await db.query('select id,lesson_id,type,prompt,explanation,content,order_index from questions where order_index<1000 order by id')).rows;
  const migration = await readFile(new URL('../supabase/migrations/202610140001_ten_exercises.sql', import.meta.url), 'utf8');
  await db.exec(migration);
  for (const [index, table] of tables.entries()) assert.deepEqual((await db.query(`select * from ${table} order by id`)).rows, before[index]!.rows);
  assert.deepEqual((await db.query('select id,lesson_id,type,prompt,explanation,content,order_index from questions where id=any($1::text[]) order by id', [questions.map(question => question.id)])).rows, questions);
  assert.deepEqual(await complete(old.lessons[0]!, 'before-upgrade'), receipt);
  for (const lesson of old.lessons.slice(1)) {
    const result = (await complete(lesson, 'queued-' + lesson.id)).result;
    assert.equal(result.total, 5); assert.equal(result.xpEarned, 25);
  }
  assert.equal((await db.query<{ xp_total: number }>('select xp_total from profiles')).rows[0]!.xp_total, 2500);
  await assert.rejects(complete(initialUnit.lessons[0]!, 'incomplete-new', { ...answersFor(old.lessons[0]!), [initialUnit.lessons[0]!.questions[5]!.id]: '1' }), /answer_invalid/);
  const review = await complete(initialUnit.lessons[0]!, 'review-ten', answersFor(initialUnit.lessons[0]!, 8));
  assert.deepEqual([review.result.correct, review.result.total, review.result.xpEarned], [8, 10, 0]);
  await db.exec(migration);
  assert.equal((await db.query<{ n: number }>("select count(*)::int n from questions where order_index<1000 and type<>'content_card'")).rows[0]!.n, 1000);
  assert.equal((await db.query<{ avatar_key: string }>('select avatar_key from profiles')).rows[0]!.avatar_key, 'owl');
});
