import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { combineUnits, legacyLearningUnits as learningUnits, legacyLessonIds } from '../src/data/lessons.ts';
import { decodeSnapshot } from '../src/lib/backendDecoders.ts';
import { journeyGeometry } from '../src/lib/journeyLayout.ts';
import { avatarOptions, resolveAvatarKey } from '../src/constants/avatarKeys.ts';
import { answersFor } from './learningFixtures.ts';
const initialUnit=combineUnits(learningUnits);

test('coin-only journey keeps alternating lanes inside narrow and wide screens',()=>{
  for (const width of [144,240,272,320,480]) {
    for(let index=0;index<100;index++) {
      const geometry=journeyGeometry(width,index);
      assert.equal(geometry.position,['center','left','right'][index%3]);
      assert.ok(geometry.centerX-geometry.clusterWidth/2>=0);
      assert.ok(geometry.centerX+geometry.clusterWidth/2<=width);
    }
  }
});

test('trail has no companion renderer or positioning while animal avatar keys and assets remain',async()=>{
  for(const file of ['src/components/learning/JourneyTrail.tsx','src/lib/journeyLayout.ts','src/constants/trailAssets.ts']) {
    const source=await readFile(new URL('../'+file,import.meta.url),'utf8');
    assert.doesNotMatch(source,/journeyDecoration|trailCharacters|companion|assets\/characters/);
  }
  const avatarSource=await readFile(new URL('../src/constants/avatars.ts',import.meta.url),'utf8');
  for(const key of ['owl','lamb','fox','dove','turtle']) {
    assert.ok(avatarOptions.some(option=>option.key === key));
    assert.equal(resolveAvatarKey(key),key);
    assert.ok(avatarSource.includes(`assets/characters/${key}.png`));
    const asset=await readFile(new URL(`../assets/characters/${key}.png`,import.meta.url));
    assert.equal(asset.subarray(1,4).toString(),'PNG');
  }
});

test('migration preserves existing content, XP, streak, attempts, avatars and legacy unlocked lessons',async t=>{
  const db=await PGlite.create();t.after(()=>db.close());
  await db.exec(`create role anon nologin;create role authenticated nologin;
    create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated;`);
  for(const file of ['202610050001_auth_profiles.sql','202610060001_learning_schema.sql','202610060002_learning_functions.sql','202610060003_leaderboard.sql'])
    await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('./legacy-seed.sql',import.meta.url),'utf8'));
  const user='00000000-0000-4000-8000-000000000001';
  const pendingUser='00000000-0000-4000-8000-000000000002';
  const freshUser='00000000-0000-4000-8000-000000000003';
  for(const id of [user,pendingUser,freshUser]) await db.query("insert into auth.users values($1,'{}')",[id]);
  const asUser=<T>(id:string,fn:(tx:Parameters<Parameters<typeof db.transaction>[0]>[0])=>Promise<T>)=>db.transaction(async tx=>{
    await tx.exec('set local role authenticated');await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[id]);return fn(tx);
  });
  const complete=(id:string,lessonId:string,attempt:string)=>asUser(id,tx=>tx.query('select public.complete_learning_lesson($1,$2::jsonb,$3)',[lessonId,JSON.stringify(answersFor(initialUnit.lessons.find(lesson=>lesson.id === lessonId)!)),attempt]));
  for(const [index,id] of legacyLessonIds.slice(0,4).entries()) await complete(user,id,`old-${index}`);
  for(const [index,id] of legacyLessonIds.slice(0,3).entries()) await complete(pendingUser,id,`pending-${index}`);
  const oldQuestions=(await db.query('select id,lesson_id,type,prompt,content,explanation,order_index from public.questions order by id')).rows;
  const before=(await db.query('select xp_total,current_streak,longest_streak,last_activity_date,avatar_key from profiles where id=$1',[user])).rows;
  const receipts=(await db.query('select * from lesson_attempts where user_id=$1 order by id',[user])).rows;
  const migration=await readFile(new URL('../supabase/migrations/202610060004_learning_journey.sql',import.meta.url),'utf8');
  await db.exec(migration);
  assert.deepEqual((await db.query('select xp_total,current_streak,longest_streak,last_activity_date,avatar_key from profiles where id=$1',[user])).rows,before);
  assert.deepEqual((await db.query('select * from lesson_attempts where user_id=$1 order by id',[user])).rows,receipts);
  assert.deepEqual((await db.query('select id,lesson_id,type,prompt,content,explanation,order_index from public.questions where id=any($1::text[]) order by id',[oldQuestions.map(row=>row.id)])).rows,oldQuestions);
  assert.deepEqual((await db.query<{n:number}>('select count(*)::int n from questions q join lessons l on l.id=q.lesson_id group by l.unit_id order by l.unit_id')).rows.map(row=>row.n),[20,20]);
  const snapshot=()=>asUser(user,async tx=>decodeSnapshot((await tx.query<{value:unknown}>('select public.learning_snapshot() value')).rows[0]!.value,user,initialUnit));
  assert.equal((await snapshot()).progress.xp,100);
  assert.ok((await snapshot()).progress.completedLessonIds.includes('personagens-importantes'));
  await complete(user,'personagens-importantes','review-moved');assert.equal((await snapshot()).progress.xp,100);
  await complete(pendingUser,'personagens-importantes','offline-old');
  await assert.rejects(complete(freshUser,learningUnits[1]!.lessons[0]!.id,'locked-unit-two'),/lesson_locked/);
  await assert.rejects(complete(user,'criacao-noe-e-abraao','still-needs-review'),/lesson_locked/);
  await complete(user,'revisao','finish-unit-one');await complete(user,'criacao-noe-e-abraao','continue-unit-two');
  assert.equal((await snapshot()).progress.xp,150);
  await asUser(user,async tx=>{
    for(const key of ['owl','lamb','fox','dove','turtle']) {
      await tx.query('update profiles set avatar_key=$1 where id=auth.uid()',[key]);
      assert.equal((await tx.query<{avatar_key:string}>('select avatar_key from profiles')).rows[0]!.avatar_key,key);
    }
  });
  assert.equal((await snapshot()).profile.avatar_key,'turtle');
  const earned=(await db.query('select xp_total,current_streak,longest_streak,avatar_key from profiles where id=$1',[user])).rows;
  const completed=(await db.query('select * from user_lesson_progress where user_id=$1 order by id',[user])).rows;
  const attempts=(await db.query('select * from lesson_attempts where user_id=$1 order by id',[user])).rows;
  await db.exec(await readFile(new URL('../supabase/migrations/202610070001_varied_exercises.sql',import.meta.url),'utf8'));
  assert.deepEqual((await db.query('select xp_total,current_streak,longest_streak,avatar_key from profiles where id=$1',[user])).rows,earned);
  assert.deepEqual((await db.query('select * from user_lesson_progress where user_id=$1 order by id',[user])).rows,completed);
  assert.deepEqual((await db.query('select * from lesson_attempts where user_id=$1 order by id',[user])).rows,attempts);
  await complete(pendingUser,'revisao','queued-before-new-formats');
});
