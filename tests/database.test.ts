import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { combineUnits, initialUnit, legacyLearningUnits } from '../src/data/lessons.ts';
import { answersFor } from './learningFixtures.ts';
import { learningSeed } from '../scripts/generate-seed.ts';
import { decodeSnapshot, object } from '../src/lib/backendDecoders.ts';

test('real PostgreSQL: migrations, seed, RLS, scoring, idempotency, import and server streak', async t => {
  const db = await PGlite.create();
  t.after(()=>db.close());
  await db.exec(`create role anon nologin; create role authenticated nologin;
    create schema auth; create table auth.users(id uuid primary key, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema public,auth to anon,authenticated;`);
  for (const file of ['202610050001_auth_profiles.sql','202610060001_learning_schema.sql','202610060002_learning_functions.sql','202610060003_leaderboard.sql','202610060004_learning_journey.sql','202610070001_varied_exercises.sql','202610080001_expanded_curriculum.sql','202610140001_ten_exercises.sql']) {
    await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  }
  const seed = await readFile(new URL('../supabase/seed.sql',import.meta.url),'utf8');
  assert.equal(seed,learningSeed());
  await db.exec(seed);
  await db.exec(seed); // The seed is safe to run again.
  const users = Array.from({length:9},(_,i)=>`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`);
  for (const id of users) await db.query("insert into auth.users values($1,'{\"display_name\":\"Aprendiz\"}')",[id]);
  const first = initialUnit.lessons[0]!;
  const asUser = <T>(id:string,fn:(tx:Parameters<Parameters<typeof db.transaction>[0]>[0])=>Promise<T>) =>
    db.transaction(async tx => { await tx.exec('set local role authenticated'); await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[id]); return fn(tx); });
  const rpc = (id:string,lesson:string,answers:unknown,attempt:string) => asUser(id,async tx => {
    const {rows} = await tx.query<{value:Record<string,unknown>}>('select public.complete_learning_lesson($1,$2::jsonb,$3) as value',[lesson,JSON.stringify(answers),attempt]);
    return rows[0]!.value;
  });
  const snapshot = (id:string) => asUser(id,async tx=>(await tx.query<{value:unknown}>('select public.learning_snapshot() as value')).rows[0]!.value);
  const importGuest = (id:string,source:string,ids:string[],xp:number) => asUser(id,async tx=>(await tx.query<{value:unknown}>('select public.import_guest_progress($1,$2::jsonb,$3) as value',[source,JSON.stringify(ids),xp])).rows[0]!.value);
  await t.test('profiles are provisioned; published content has one thousand exercises',async()=>{
    const person = decodeSnapshot(await snapshot(users[0]!),users[0]!,initialUnit);
    assert.equal(person.profile.display_name,'Aprendiz');
    assert.equal(person.progress.xp,0);
    await db.transaction(async tx=>{ await tx.exec('set local role anon'); assert.equal((await tx.query("select * from questions where order_index<1000 and type<>'content_card'")).rows.length,1000); });
    await db.exec("insert into courses(id,title) values('draft','Draft'); insert into units(id,course_id,title,published,order_index) values('draft-unit','draft','Draft',true,1);");
    await db.transaction(async tx=>{ await tx.exec('set local role anon'); assert.equal((await tx.query("select * from units where id='draft-unit'")).rows.length,0); });
  });
  await t.test('locked and malformed answers are rejected atomically',async()=>{
    await assert.rejects(rpc(users[0]!,initialUnit.lessons[1]!.id,answersFor(initialUnit.lessons[1]!),'locked'),/lesson_locked/);
    await assert.rejects(rpc(users[0]!,first.id,{},'missing'),/answer_invalid/);
    assert.equal(decodeSnapshot(await snapshot(users[0]!),users[0]!,initialUnit).progress.xp,0);
  });
  await t.test('all sixteen formats score like the local engine; completion/retry/review never duplicate XP',async()=>{
    for (const [index,lesson] of initialUnit.lessons.entries()) {
      const value = await rpc(users[0]!,lesson.id,answersFor(lesson),`perfect-${index}`);
      assert.ok(object(value.result));
      assert.equal(value.result.xpEarned,35);
      assert.equal(value.result.correct,10);
      const repeated = await rpc(users[0]!,lesson.id,answersFor(lesson),`perfect-${index}`);
      assert.deepEqual(repeated.result,value.result);
    }
    const review = await rpc(users[0]!,first.id,answersFor(first,0),'review');
    assert.ok(object(review.result)); assert.equal(review.result.xpEarned,0);
    const person = decodeSnapshot(await snapshot(users[0]!),users[0]!,initialUnit);
    assert.equal(person.progress.xp,3500); assert.equal(person.profile.current_streak,1);
    assert.equal((await db.query<{n:number}>('select count(*)::int as n from xp_events where user_id=$1',[users[0]])).rows[0]!.n,100);
    await assert.rejects(rpc(users[0]!,first.id,answersFor(first,0),'perfect-0'),/attempt_conflict/);
  });
  await t.test('wrong answers earn completion XP; parallel retries award once',async()=>{
    const [a,b] = await Promise.all([rpc(users[1]!,first.id,answersFor(first,0),'same'),rpc(users[1]!,first.id,answersFor(first,0),'same')]);
    assert.deepEqual(a.result,b.result); assert.ok(object(a.result)); assert.equal(a.result.xpEarned,10);
    assert.equal(decodeSnapshot(await snapshot(users[1]!),users[1]!,initialUnit).progress.xp,10);
    const second=initialUnit.lessons[1]!;
    const wrong=await rpc(users[1]!,second.id,answersFor(second,0),'wrong-formats');
    assert.ok(object(wrong.result));assert.equal(wrong.result.correct,0);assert.equal(wrong.result.xpEarned,10);
    for(const lesson of initialUnit.lessons.slice(2)) {
      const value=await rpc(users[1]!,lesson.id,answersFor(lesson,0),'wrong-'+lesson.id);
      assert.ok(object(value.result));assert.equal(value.result.correct,0);assert.equal(value.result.xpEarned,10);
    }
  });
  await t.test('RLS hides other accounts and blocks forged writes/content changes/internal functions',async()=>{
    await asUser(users[1]!,async tx=>{
      assert.equal((await tx.query('select * from profiles')).rows.length,1);
      assert.equal((await tx.query('select * from profiles where id=$1',[users[0]])).rows.length,0);
      for (const table of ['user_lesson_progress','xp_events','lesson_attempts','user_daily_activity','guest_progress_imports']) {
        assert.equal((await tx.query(`select * from ${table} where user_id=$1`,[users[0]])).rows.length,0);
      }
      await tx.query("update profiles set display_name='Novo nome',username='novo_nome',avatar_key='learner' where id=$1",[users[1]]);
      assert.equal((await tx.query("update profiles set display_name='Invadido' where id=$1 returning id",[users[0]])).rows.length,0);
    });
    for (const sql of ["update profiles set xp_total=9999","update profiles set current_streak=999","delete from user_lesson_progress","insert into xp_events(user_id,lesson_id,amount,reason) values(auth.uid(),'o-que-e-a-biblia',999,'lesson_completed')","update questions set prompt='fake'","select public.record_learning_activity(auth.uid(),1,999)"]) {
      await assert.rejects(asUser(users[1]!,tx=>tx.exec(sql)),/permission denied/);
    }
    await db.transaction(async tx=>{ await tx.exec('set local role anon'); await assert.rejects(tx.exec('select public.learning_snapshot()'),/permission denied/); });
  });
  await t.test('legacy import carries bounded XP without fake scores, duplicates or cross-account copying',async()=>{
    const ids = initialUnit.lessons.slice(0,8).map(l=>l.id);
    const imported = decodeSnapshot(await importGuest(users[2]!,'legacy-118',ids,118),users[2]!,initialUnit);
    assert.equal(imported.progress.xp,118); assert.equal(imported.guestImported,true); assert.equal(imported.progress.lastResult,null);
    const repeated = decodeSnapshot(await importGuest(users[2]!,'legacy-118',ids,118),users[2]!,initialUnit);
    assert.equal(repeated.progress.xp,118);
    await assert.rejects(importGuest(users[3]!,'legacy-118',ids,118),/guest_already_imported/);
    await assert.rejects(importGuest(users[4]!,'invalid',[ids[1]!],25),/guest_invalid/);
    await assert.rejects(importGuest(users[4]!,'invalid',[ids[0]!],999),/guest_invalid/);
    assert.equal((await db.query<{score:null}>('select score from user_lesson_progress where user_id=$1',[users[2]])).rows[0]!.score,null);
    await rpc(users[5]!,first.id,answersFor(first),'existing');
    const overlap = decodeSnapshot(await importGuest(users[5]!,'overlap',ids.slice(0,2),50),users[5]!,initialUnit);
    assert.equal(overlap.progress.xp,50);
  });
  await t.test('streak uses server dates; same day coalesces, gaps reset current but preserve longest',async()=>{
    const id=users[6]!;
    async function day(date:string) { await db.exec(`create or replace function public.learning_day() returns date language sql stable set search_path='' as $$ select '${date}'::date $$;`); }
    await day('2026-10-01'); await rpc(id,first.id,answersFor(first),'day1');
    await day('2026-10-02'); await rpc(id,first.id,answersFor(first),'day2'); await rpc(id,first.id,answersFor(first),'day2-again');
    let person=decodeSnapshot(await snapshot(id),id,initialUnit);
    assert.equal(person.profile.current_streak,2); assert.equal(person.profile.longest_streak,2);
    assert.equal((await db.query<{n:number}>('select count(*)::int as n from user_daily_activity where user_id=$1',[id])).rows[0]!.n,2);
    await day('2026-10-04'); person=decodeSnapshot(await snapshot(id),id,initialUnit); assert.equal(person.profile.current_streak,0);
    await rpc(id,first.id,answersFor(first),'after-gap'); person=decodeSnapshot(await snapshot(id),id,initialUnit);
    assert.equal(person.profile.current_streak,1); assert.equal(person.profile.longest_streak,2);
  });
  await t.test('content cards require acknowledgement but never add correct answers/XP',async()=>{
    await db.query("insert into questions(id,lesson_id,type,prompt,content,order_index) values('card',$1,'content_card','Leia',$2::jsonb,10)",[first.id,JSON.stringify({body:'A Bíblia reúne livros.',options:[],correctAnswer:'seen'})]);
    await assert.rejects(rpc(users[7]!,first.id,answersFor(first),'unread'),/answer_invalid|answer_incomplete/);
    const value=await rpc(users[7]!,first.id,{...answersFor(first),card:'seen'},'read');
    assert.ok(object(value.result)); assert.equal(value.result.total,10); assert.equal(value.result.xpEarned,35);
  });
  await t.test('previous curriculum attempts still score once after additive upgrade',async()=>{
    const old=combineUnits(legacyLearningUnits).lessons[0]!;
    const value=await rpc(users[8]!,old.id,answersFor(old),'old-offline');
    assert.ok(object(value.result));assert.equal(value.result.correct,5);assert.equal(value.result.total,5);assert.equal(value.result.xpEarned,25);
    const repeated=await rpc(users[8]!,old.id,answersFor(old),'old-offline');assert.deepEqual(value.result,repeated.result);
    await assert.rejects(rpc(users[8]!,old.id,{...answersFor(old),...answersFor(first)},'mixed-version'),/answer_invalid/);
  });
});
