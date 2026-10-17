import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { initialUnit } from '../src/data/lessons.ts';
import { answersFor } from './learningFixtures.ts';

test('hard-deleting auth user cascades all personal data but preserves other users, ranking and curriculum', async t => {
  const db = await PGlite.create(); t.after(() => db.close());
  await db.exec(`create role anon nologin; create role authenticated nologin;
    create schema auth; create table auth.users(id uuid primary key, raw_user_meta_data jsonb);
    create table auth.sessions(id uuid primary key, user_id uuid references auth.users(id) on delete cascade);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated;`);
  for (const file of ['202610050001_auth_profiles.sql','202610060001_learning_schema.sql','202610060002_learning_functions.sql','202610060003_leaderboard.sql','202610060004_learning_journey.sql','202610070001_varied_exercises.sql','202610080001_expanded_curriculum.sql','202610140001_ten_exercises.sql']) await db.exec(await readFile(new URL('../supabase/migrations/' + file, import.meta.url), 'utf8'));
  const users = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002'];
  for (const id of users) {
    await db.query("insert into auth.users values($1,'{}')", [id]); await db.query('insert into auth.sessions values($1,$1)', [id]);
    await db.transaction(async tx => {
      await tx.exec('set local role authenticated'); await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [id]);
      await tx.query('select complete_learning_lesson($1,$2::jsonb,$3)', [initialUnit.lessons[0]!.id, JSON.stringify(answersFor(initialUnit.lessons[0]!)), 'first']);
      await tx.query('select import_guest_progress($1,$2::jsonb,35)', ['guest-' + id, JSON.stringify([initialUnit.lessons[0]!.id])]);
    });
    for (const table of ['auth.users', 'profiles']) await assert.rejects(db.transaction(async tx => {
      await tx.exec('set local role authenticated'); await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [id]);
      await tx.exec(`delete from ${table}`);
    }), /permission denied/);
  }
  const tables = ['user_lesson_progress', 'lesson_attempts', 'xp_events', 'user_daily_activity', 'guest_progress_imports'];
  const other = await Promise.all(tables.map(table => db.query(`select * from ${table} where user_id=$1`, [users[1]])));
  const otherProfile = (await db.query('select * from profiles where id=$1', [users[1]])).rows;
  const content = await Promise.all(['courses', 'units', 'lessons', 'questions'].map(table => db.query(`select count(*)::int n from ${table}`)));
  await db.query('delete from auth.users where id=$1', [users[0]]);
  assert.equal((await db.query('select * from profiles where id=$1', [users[0]])).rows.length, 0);
  assert.equal((await db.query('select * from auth.sessions where user_id=$1', [users[0]])).rows.length, 0);
  assert.deepEqual((await db.query('select * from profiles where id=$1', [users[1]])).rows, otherProfile);
  for (const [index, table] of tables.entries()) {
    assert.equal((await db.query(`select * from ${table} where user_id=$1`, [users[0]])).rows.length, 0, table);
    assert.deepEqual((await db.query(`select * from ${table} where user_id=$1`, [users[1]])).rows, other[index]!.rows);
  }
  assert.deepEqual(await Promise.all(['courses', 'units', 'lessons', 'questions'].map(table => db.query(`select count(*)::int n from ${table}`))), content);
  await db.transaction(async tx => {
    await tx.exec('set local role anon'); const result = (await tx.query<{ value: { top: { id: string }[] } }>('select learning_leaderboard() value')).rows[0]!.value;
    assert.ok(!result.top.some(row => row.id === users[0])); assert.ok(result.top.some(row => row.id === users[1]));
  });
});
