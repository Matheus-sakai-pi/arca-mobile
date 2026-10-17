import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { normalizeUsername, validUsername, hasChosenUsername } from '../src/lib/username.ts';
import { authErrorMessage, validateAuth } from '../src/services/validation.ts';

test('one public username accepts optional @, normalizes case and distinguishes legacy profiles',()=>{
  assert.equal(normalizeUsername(' @Matheus_Sakai '),'matheus_sakai');
  for(const value of ['abc',' @Maria_123 ','x'.repeat(30)]) assert.equal(validUsername(value),true);
  for(const value of ['ab','a b','joão','abc%','@@maria','x'.repeat(31)]) assert.equal(validUsername(value),false);
  assert.equal(hasChosenUsername({username:'maria',display_name:'@maria'}),true);
  assert.equal(hasChosenUsername({username:'maria',display_name:'Maria'}),false);
  assert.equal(hasChosenUsername({username:'arca_'+'a'.repeat(32),display_name:'Matheus'}),false);
  assert.match(authErrorMessage(new Error('username_taken')),/já está em uso/);
  const fields={name:'Maria Silva',email:'maria@example.test',password:'password',confirmPassword:'password'};
  assert.ok(validateAuth('signup',fields).name);
  assert.deepEqual(validateAuth('signup',{...fields,name:'@maria_silva'}),{});
});

test('real PostgreSQL: atomic public-name provisioning, legacy preservation and case-insensitive uniqueness',async t=>{
  const db=await PGlite.create();t.after(()=>db.close());
  await db.exec(`create role anon nologin;create role authenticated nologin;
    create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated;`);
  const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
  const add=(n:number,metadata:object)=>db.query('insert into auth.users values($1,$2::jsonb)',[id(n),JSON.stringify(metadata)]);
  for(const file of ['202610050001_auth_profiles.sql','202610060001_learning_schema.sql','202610060002_learning_functions.sql','202610060003_leaderboard.sql','202610150001_friends_weekly.sql'])
    await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  await add(1,{display_name:'Nome Antigo'});await add(2,{display_name:'Outra Pessoa'});
  await db.query('update profiles set xp_total=148,current_streak=3,longest_streak=7 where id=$1',[id(1)]);
  await db.query("insert into learning_friendships(person_a,person_b,requested_by,status) values($1,$2,$1,'accepted')",[id(1),id(2)]);
  const before=(await db.query('select * from profiles order by id')).rows;
  await db.exec(await readFile(new URL('../supabase/migrations/202610150002_public_username.sql',import.meta.url),'utf8'));
  assert.deepEqual((await db.query('select * from profiles order by id')).rows,before,'Migration must not rename or reset any existing account');
  const asUser=<T>(owner:string|null,fn:(tx:Parameters<Parameters<typeof db.transaction>[0]>[0])=>Promise<T>)=>db.transaction(async tx=>{
    await tx.exec('set local role '+(owner ? 'authenticated':'anon'));await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[owner??'']);return fn(tx);
  });
  const available=(name:string,owner:string|null=null)=>asUser(owner,async tx=>(await tx.query<{value:boolean}>('select learning_username_available($1) as value',[name])).rows[0]!.value);
  await t.test('new registration derives both identities from the unique handle and rejects invalid/duplicate accounts atomically',async()=>{
    assert.equal(await available(' @MARIA '),true);
    await add(3,{username:' @MARIA ',display_name:'Ignored name'});
    const person=(await db.query<{username:string;display_name:string}>('select username,display_name from profiles where id=$1',[id(3)])).rows[0]!;
    assert.deepEqual(person,{username:'maria',display_name:'@maria'});
    assert.equal(await available('maria'),false);assert.equal(await available('@MARIA',id(3)),true);
    await assert.rejects(add(4,{username:'Maria'}),/username_taken|unique/);
    assert.equal((await db.query('select * from auth.users where id=$1',[id(4)])).rows.length,0);
    for(const username of ['ab','two words','a'.repeat(31),'@@abc','joão','']) await assert.rejects(add(4,{username}),/username_invalid/);
    assert.equal((await db.query('select * from profiles where id=$1',[id(4)])).rows.length,0);
  });
  await t.test('owner selects one name without changing XP/avatar/streak/friends; others cannot edit it',async()=>{
    await asUser(id(1),tx=>tx.query("update profiles set username='@Matheus_Sakai',display_name='anything' where id=$1",[id(1)]));
    const after=(await db.query<Record<string,unknown>>('select * from profiles where id=$1',[id(1)])).rows[0]!;
    assert.equal(after.username,'matheus_sakai');assert.equal(after.display_name,'@matheus_sakai');
    for(const field of ['id','xp_total','avatar_key','current_streak','longest_streak','created_at']) assert.deepEqual(after[field],(before[0] as Record<string,unknown>)[field]);
    assert.equal((await db.query('select * from learning_friendships')).rows.length,1);
    assert.equal((await asUser(id(2),tx=>tx.query("update profiles set username='hacked' where id=$1 returning id",[id(1)]))).rows.length,0);
    await assert.rejects(asUser(id(2),tx=>tx.query("update profiles set username='MATHEUS_SAKAI' where id=$1",[id(2)])),/username_taken|unique/);
    await assert.rejects(asUser(id(1),tx=>tx.exec('update profiles set xp_total=99999')),/permission denied/);
    assert.equal((await available('matheus_sakai')),false);
    const ranking=(await asUser(id(1),tx=>tx.query<{value:{top:{display_name:string}[]}}> ('select learning_leaderboard() as value'))).rows[0]!.value;
    assert.equal(ranking.top[0]?.display_name,'@matheus_sakai');
    const found=(await asUser(id(2),tx=>tx.query<{value:{display_name:string}[]}>('select search_learning_people($1) as value',['@matheus']))).rows[0]!.value;
    assert.equal(found[0]?.display_name,'@matheus_sakai');
  });
  await t.test('old clients can still register, avatar updates preserve legacy identity and internal functions remain private',async()=>{
    await add(5,{display_name:'Old Client'});
    await asUser(id(5),tx=>tx.query("update profiles set avatar_key='dove' where id=$1",[id(5)]));
    const profile=(await db.query<{username:string;display_name:string}>('select username,display_name from profiles where id=$1',[id(5)])).rows[0]!;
    assert.equal(profile.display_name,'Old Client');assert.equal(profile.username,'arca_'+id(5).replaceAll('-',''));
    await assert.rejects(asUser(null,tx=>tx.exec('select * from profiles')),/permission denied/);
    await assert.rejects(asUser(id(1),tx=>tx.exec('select enforce_public_username()')),/permission denied/);
  });
});
