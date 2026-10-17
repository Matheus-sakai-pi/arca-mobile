import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { initialUnit } from '../src/data/lessons.ts';
import { answersFor } from './learningFixtures.ts';

test('local backup restore preserves learning records, RLS and idempotency without restoring an erased account',async()=>{
  const original=await PGlite.create();
  let restored:PGlite|null=null;
  try {
    await original.exec(`create role anon nologin;create role authenticated nologin;create schema auth;
      create table auth.users(id uuid primary key,raw_user_meta_data jsonb);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth to anon,authenticated;`);
    for(const name of ['202610050001_auth_profiles.sql','202610060001_learning_schema.sql','202610060002_learning_functions.sql','202610060003_leaderboard.sql','202610060004_learning_journey.sql','202610070001_varied_exercises.sql','202610080001_expanded_curriculum.sql','202610140001_ten_exercises.sql'])await original.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
    const owner='00000000-0000-4000-8000-000000000001',deleted='00000000-0000-4000-8000-000000000002';
    await original.query("insert into auth.users values($1,'{}'),($2,'{}')",[owner,deleted]);
    const complete=async(db:PGlite)=>db.transaction(async tx=>{
      await tx.exec('set local role authenticated');await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[owner]);
      return (await tx.query<{value:unknown}>('select complete_learning_lesson($1,$2::jsonb,$3) value',[initialUnit.lessons[0]!.id,JSON.stringify(answersFor(initialUnit.lessons[0]!)),'restore-attempt'])).rows[0]!.value;
    });
    const receipt=await complete(original);
    await original.query('delete from auth.users where id=$1',[deleted]);
    const archive=await original.dumpDataDir();
    restored=await PGlite.create({loadDataDir:archive});
    assert.deepEqual(await complete(restored),receipt);
    assert.equal((await restored.query<{n:number}>('select count(*)::int n from xp_events')).rows[0]!.n,1);
    assert.equal((await restored.query<{xp_total:number}>('select xp_total from profiles where id=$1',[owner])).rows[0]!.xp_total,35);
    assert.equal((await restored.query('select * from auth.users where id=$1',[deleted])).rows.length,0);
    await assert.rejects(restored.transaction(async tx=>{await tx.exec('set local role anon');await tx.query('select * from profiles');}),/permission denied/);
    await restored.transaction(async tx=>{await tx.exec('set local role authenticated');await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[deleted]);assert.equal((await tx.query('select * from profiles')).rows.length,0);});
    assert.equal((await restored.query<{n:number}>("select count(*)::int n from questions where order_index<1000 and type<>'content_card'")).rows[0]!.n,1000);
  } finally {await restored?.close();await original.close();}
});
