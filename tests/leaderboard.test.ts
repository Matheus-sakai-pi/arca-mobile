import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { decodeLeaderboard, ownPositionOutsideTop } from '../src/lib/leaderboard.ts';
import { avatarOptions, isAvatarKey, resolveAvatarKey } from '../src/constants/avatarKeys.ts';

test('leaderboard decoder rejects malformed/cross-account data and exposes only public fields',()=>{
  const row={id:'a',display_name:'Aprendiz',avatar_key:'avatar-03',xp_total:25,position:1};
  const value=decodeLeaderboard({top:[{...row,email:'private'}],current:row},'a');
  assert.deepEqual(value.top,[row]);assert.equal(ownPositionOutsideTop(value),null);
  assert.equal(ownPositionOutsideTop({top:[],current:{...row,position:37}})?.position,37);
  assert.throws(()=>decodeLeaderboard({top:[row,row],current:null},null));
  assert.throws(()=>decodeLeaderboard({top:[{...row,position:2}],current:null},null));
  assert.throws(()=>decodeLeaderboard({top:[],current:row},'b'));
  assert.throws(()=>decodeLeaderboard({top:[{...row,xp_total:-1}],current:null},null));
  assert.deepEqual(decodeLeaderboard({top:[],current:null},null),{top:[],current:null});
});

test('ten genuine distinct PNG avatars and predictable legacy fallback',async()=>{
  assert.equal(avatarOptions.length,10);assert.equal(resolveAvatarKey('learner'),'avatar-01');
  assert.equal(resolveAvatarKey('missing'),'avatar-01');assert.equal(resolveAvatarKey(null),'avatar-01');
  assert.equal(isAvatarKey('avatar-03'),true);assert.equal(isAvatarKey('avatar-99'),false);
  const images=await Promise.all(avatarOptions.map(async({key})=>readFile(new URL('../assets/'+(key.startsWith('avatar-') ? 'avatars/' : 'characters/')+key+'.png',import.meta.url))));
  for(const png of images){assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.ok(png.readUInt32BE(16)>=512);assert.equal(png.readUInt32BE(16),png.readUInt32BE(20));}
  assert.equal(new Set(images.map(png=>png.toString('base64'))).size,10);
});

test('real PostgreSQL leaderboard: top10, exact own rank, deterministic ties, privacy and avatar RLS',async t=>{
  const db=await PGlite.create();t.after(()=>db.close());
  await db.exec(`create role anon nologin;create role authenticated nologin;
    create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated;`);
  for(const file of ['202610050001_auth_profiles.sql','202610060001_learning_schema.sql','202610060002_learning_functions.sql','202610060003_leaderboard.sql'])
    await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  const user=(i:number)=>`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`;
  const asUser=<T>(id:string|null,fn:(tx:Parameters<Parameters<typeof db.transaction>[0]>[0])=>Promise<T>)=>db.transaction(async tx=>{
    await tx.exec('set local role '+(id ? 'authenticated':'anon'));
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[id??'']);return fn(tx);
  });
  const ranking=(id:string|null)=>asUser(id,async tx=>decodeLeaderboard((await tx.query<{value:unknown}>('select public.learning_leaderboard() as value')).rows[0]!.value,id));
  await t.test('empty has no imaginary players',async()=>assert.deepEqual(await ranking(null),{top:[],current:null}));
  for(let i=1;i<=3;i++)await db.query("insert into auth.users values($1,$2::jsonb)",[user(i),JSON.stringify({display_name:`Aprendiz ${i}`,email:'never-public@example.test'})]);
  await t.test('less than ten returns actual users, ties use UUID, own row is not duplicated',async()=>{
    const result=await ranking(user(2));assert.deepEqual(result.top.map(row=>row.id),[user(1),user(2),user(3)]);
    assert.equal(result.current?.position,2);assert.equal(ownPositionOutsideTop(result),null);
    assert.deepEqual(await ranking(user(2)),result);
    assert.equal((await ranking(null)).current,null);
  });
  for(let i=4;i<=37;i++)await db.query("insert into auth.users values($1,$2::jsonb)",[user(i),JSON.stringify({display_name:`Aprendiz ${i}`})]);
  await db.exec('update public.profiles set xp_total=100');
  await db.query('update public.profiles set xp_total=200 where id=$1',[user(3)]);
  await t.test('top10 is limited, own rank is accurate outside top10, name/avatar updates never reorder ties',async()=>{
    const result=await ranking(user(37));assert.equal(result.top.length,10);assert.equal(result.top[0]?.id,user(3));
    assert.equal(result.current?.position,37);assert.equal(ownPositionOutsideTop(result)?.id,user(37));
    assert.deepEqual(result.top.map(row=>row.position),[1,2,3,4,5,6,7,8,9,10]);
    await asUser(user(2),tx=>tx.query("update public.profiles set display_name='Nome novo',avatar_key='avatar-03' where id=$1",[user(2)]));
    const refreshed=await ranking(user(2));assert.equal(refreshed.current?.position,3);assert.equal(refreshed.current?.avatar_key,'avatar-03');
    assert.deepEqual(refreshed.top.map(row=>row.id),result.top.map(row=>row.id));
  });
  await t.test('RPC exposes exactly five public fields; table/auth privacy and protected XP remain intact',async()=>{
    const result=await ranking(null);
    for(const row of result.top)assert.deepEqual(Object.keys(row).sort(),['avatar_key','display_name','id','position','xp_total']);
    await asUser(user(37),async tx=>{
      assert.equal((await tx.query('select * from public.profiles')).rows.length,1);
      assert.equal((await tx.query("update public.profiles set avatar_key='avatar-04' where id=$1 returning id",[user(1)])).rows.length,0);
    });
    await assert.rejects(asUser(null,tx=>tx.query('select * from public.profiles')),/permission denied/);
    await assert.rejects(asUser(user(37),tx=>tx.exec('update public.profiles set xp_total=9999')),/permission denied/);
    for(const option of avatarOptions){
      await asUser(user(37),tx=>tx.query('update public.profiles set avatar_key=$1 where id=$2',[option.key,user(37)]));
      assert.equal((await ranking(user(37))).current?.avatar_key,option.key);
    }
    await assert.rejects(asUser(user(37),tx=>tx.exec('select * from auth.users')),/permission denied/);
  });
});
