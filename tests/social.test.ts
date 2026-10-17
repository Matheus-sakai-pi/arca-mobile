import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { decodeFriends, decodePeople, friendQuery } from '../src/lib/friends.ts';
import { decodeLeaderboard } from '../src/lib/leaderboard.ts';

test('social decoders validate identities, bounds, relationships and public projection',()=>{
  assert.equal(friendQuery(' @Bia_123 '),'bia_123');
  for(const query of ['ab','a%bc','a bc','alguem@email.test','x'.repeat(61)]) assert.equal(friendQuery(query),null);
  const person={id:'other',username:'bia_123',display_name:'Bia',avatar_key:'avatar-03',relationship:'friend'};
  assert.deepEqual(decodePeople([{...person,email:'private'}],'me'),[person]);
  assert.throws(()=>decodePeople([person],'other'));
  assert.throws(()=>decodePeople([person,person],'me'));
  assert.throws(()=>decodeFriends({friends:[person],incoming:[person],outgoing:[]},'me'));
  assert.throws(()=>decodePeople([{...person,relationship:'accepted'}],'me'));
  const period={start:'2026-10-12T03:00:00Z',end:'2026-10-19T03:00:00Z'};
  assert.deepEqual(decodeLeaderboard({top:[],current:null,period},null,'weekly'),{top:[],current:null,period});
  assert.throws(()=>decodeLeaderboard({top:[],current:null},null,'weekly'));
  assert.throws(()=>decodeLeaderboard({top:[],current:null,period:{...period,end:'bad'}},null,'weekly'));
});

test('real PostgreSQL: friendship consent, privacy, limits, weekly boundaries and accepted-only ranking',async t=>{
  const db=await PGlite.create();t.after(()=>db.close());
  await db.exec(`create role anon nologin;create role authenticated nologin;
    create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated;`);
  for(const file of ['202610050001_auth_profiles.sql','202610060001_learning_schema.sql','202610060002_learning_functions.sql','202610060003_leaderboard.sql','202610150001_friends_weekly.sql'])
    await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  const user=(i:number)=>`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`;
  await db.exec(`insert into auth.users select ('00000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,jsonb_build_object('display_name','Pessoa '||i) from generate_series(1,260) i;
    update public.profiles set username='buddy_'||right(id::text,3),xp_total=100;
    insert into public.courses(id,title) values('course','Course');
    insert into public.units(id,course_id,title,order_index) values('unit','course','Unit',0);
    insert into public.lessons(id,unit_id,title,order_index) select 'lesson-'||i,'unit','Lesson '||i,i from generate_series(1,10) i;`);
  const asUser=<T>(id:string|null,fn:(tx:Parameters<Parameters<typeof db.transaction>[0]>[0])=>Promise<T>)=>db.transaction(async tx=>{
    await tx.exec('set local role '+(id ? 'authenticated' : 'anon'));
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[id ?? '']);return fn(tx);
  });
  const act=(who:number,target:number,action:string)=>asUser(user(who),async tx=>decodeFriends((await tx.query<{value:unknown}>('select public.learning_friend_action($1,$2) as value',[user(target),action])).rows[0]!.value,user(who)));
  const friends=(who:number)=>asUser(user(who),async tx=>decodeFriends((await tx.query<{value:unknown}>('select public.learning_friends() as value')).rows[0]!.value,user(who)));
  const search=(who:number,query:string)=>asUser(user(who),async tx=>decodePeople((await tx.query<{value:unknown}>('select public.search_learning_people($1) as value',[query])).rows[0]!.value,user(who)));
  const ranking=(who:number|null,scope:'weekly'|'friends')=>asUser(who ? user(who) : null,async tx=>decodeLeaderboard((await tx.query<{value:unknown}>('select public.learning_leaderboard_scope($1) as value',[scope])).rows[0]!.value,who ? user(who) : null,scope));
  await t.test('requests are idempotent, reverse request does not auto-accept, only recipient accepts',async()=>{
    assert.equal((await act(1,2,'request')).outgoing.length,1);
    assert.equal((await act(1,2,'request')).outgoing.length,1);
    assert.equal((await friends(2)).incoming[0]?.id,user(1));
    await assert.rejects(act(2,1,'request'),/friend_accept_required/);
    await assert.rejects(act(1,2,'accept'),/friend_not_recipient/);
    await assert.rejects(act(3,1,'accept'),/friend_not_recipient/);
    assert.deepEqual((await ranking(1,'friends')).top.map(row=>row.id),[user(1)]);
    assert.equal((await act(2,1,'accept')).friends.length,1);
    assert.equal((await act(2,1,'accept')).friends.length,1);
    assert.deepEqual((await ranking(1,'friends')).top.map(row=>row.id),[user(1),user(2)]);
    assert.equal((await search(1,'buddy_002'))[0]?.relationship,'friend');
  });
  await t.test('cancel/decline/remove enforce membership and remove both sides',async()=>{
    await act(1,3,'request');
    await assert.rejects(act(1,3,'decline'),/friend_not_allowed/);
    await assert.rejects(act(3,1,'cancel'),/friend_not_allowed/);
    await act(3,1,'decline');assert.equal((await friends(1)).outgoing.length,0);
    await act(1,3,'request');await act(1,3,'cancel');assert.equal((await friends(3)).incoming.length,0);
    await act(1,2,'remove');assert.equal((await friends(2)).friends.length,0);
    assert.equal((await ranking(1,'friends')).top.length,1);
    await assert.rejects(act(1,1,'request'),/friend_person_invalid/);
    await assert.rejects(act(1,2,'hacked'),/friend_action_invalid/);
    await assert.rejects(act(1,999,'request'),/friend_person_missing/);
  });
  await t.test('search has bounded literal username prefixes, no email lookup, no private fields',async()=>{
    const people=await search(1,'@BUDDY_');assert.equal(people.length,20);
    for(const person of people) assert.deepEqual(Object.keys(person).sort(),['avatar_key','display_name','id','relationship','username']);
    assert.ok(!people.some(person=>person.id===user(1)));
    for(const invalid of ['bu','buddy%','someone@example.test']) await assert.rejects(search(1,invalid),/friend_query_invalid/);
    await db.query("update public.profiles set username='buddyXz' where id=$1",[user(259)]);
    assert.equal((await search(1,'buddy_')).some(person=>person.id===user(259)),false);
    assert.equal((await search(1,'buddy_258'))[0]?.id,user(258));
  });
  await t.test('RLS and grants prevent outsiders seeing or writing friendships/XP',async()=>{
    await act(1,2,'request');
    assert.equal((await asUser(user(3),tx=>tx.query('select * from public.learning_friendships'))).rows.length,0);
    assert.equal((await asUser(user(1),tx=>tx.query('select * from public.learning_friendships'))).rows.length,1);
    for(const sql of ["update public.learning_friendships set status='accepted'",'delete from public.learning_friendships',"insert into public.learning_friendships values(auth.uid(),'00000000-0000-4000-8000-000000000004',auth.uid(),'accepted')"])
      await assert.rejects(asUser(user(1),tx=>tx.exec(sql)),/permission denied/);
    for(const sql of ['select public.learning_friends()',"select public.search_learning_people('buddy')","select public.learning_friend_action('00000000-0000-4000-8000-000000000002','request')","select public.learning_leaderboard_scope('friends')"])
      await assert.rejects(asUser(null,tx=>tx.exec(sql)),/permission denied|auth_required/);
    assert.equal((await asUser(user(1),tx=>tx.query('select * from public.profiles'))).rows.length,1);
  });
  await t.test('weekly counts only confirmed lesson XP within Monday boundaries; import and total are unchanged',async()=>{
    const period=(await ranking(null,'weekly')).period!;
    const monday=new Date(period.start);assert.equal(monday.getUTCDay(),1);assert.equal(monday.getUTCHours(),3);
    const samples=[[1,1,35,'lesson_completed',0],[1,2,80,'lesson_completed',-1],[1,3,999,'guest_import',1000],[1,4,100,'lesson_completed',7*86400000],[2,1,35,'lesson_completed',1000],[3,1,50,'lesson_completed',2000]] as const;
    for(const [person,lesson,amount,reason,offset] of samples) await db.query('insert into public.xp_events(user_id,lesson_id,amount,reason,created_at) values($1,$2,$3,$4,$5)',[user(person),'lesson-'+lesson,amount,reason,new Date(Date.parse(period.start)+offset).toISOString()]);
    await db.query('update public.profiles set xp_total=9999 where id=$1',[user(1)]);
    const weekly=await ranking(1,'weekly');assert.equal(weekly.current?.xp_total,35);assert.equal(weekly.current?.position,2);
    assert.deepEqual(weekly.top.slice(0,3).map(row=>row.id),[user(3),user(1),user(2)]);
    const outside=await ranking(260,'weekly');assert.equal(outside.current?.position,260);assert.equal(outside.current?.xp_total,0);
    const total=await asUser(user(1),async tx=>decodeLeaderboard((await tx.query<{value:unknown}>('select public.learning_leaderboard() as value')).rows[0]!.value,user(1)));
    assert.equal(total.current?.xp_total,9999);assert.equal((await ranking(null,'weekly')).current,null);
  });
  await t.test('pending limits are enforced and account deletion cascades social data',async()=>{
    await db.query("insert into public.learning_friendships(person_a,person_b,requested_by,status) select id,$1,id,'accepted' from public.profiles where id<$1 order by id limit 200",[user(260)]);
    await act(260,259,'request');await assert.rejects(act(259,260,'accept'),/friend_limit/);
    await db.query("insert into public.learning_friendships(person_a,person_b,requested_by,status) select $1,id,$1,'pending' from public.profiles where id>$1 order by id limit 50",[user(100)]);
    await assert.rejects(act(100,200,'request'),/friend_limit/);
    await act(100,101,'cancel');assert.equal((await act(100,200,'request')).outgoing.length,50);
    await db.query('delete from auth.users where id=$1',[user(1)]);
    assert.equal((await friends(2)).incoming.length,0);
    assert.equal((await db.query('select * from public.learning_friendships where person_a=$1 or person_b=$1',[user(1)])).rows.length,0);
  });
});

test('social entry is protected, scope caches are separated and all requests remain account-scoped',async()=>{
  const source=async(path:string)=>readFile(new URL('../src/'+path,import.meta.url),'utf8');
  const ranking=await source('hooks/useLeaderboard.ts');
  assert.match(ranking,/result\.scope === scope/);
  assert.match(ranking,/failure\.scope === scope/);
  assert.match(ranking,/decodeLeaderboard\(data,userId,scope\)/);
  assert.match(ranking,/revision\.current\+\+;request\.current\?\.abort/);
  assert.match(await source('services/friends.ts'),/scopedSupabase\(requireSupabase\(\),owner\)/);
  const hook=await source('hooks/useFriends.ts');
  assert.match(hook,/version===epoch\.current/);
  assert.match(hook,/state\?\.owner===owner/);
  assert.match(hook,/request\.abort\(\)/);
  assert.match(await source('app/(tabs)/profile.tsx'),/title="Amigos".*router.push\('\/friends'\)/);
  const navigation=await source('app/_layout.tsx');
  assert.match(navigation,/<Stack.Protected guard=\{\(\!\!session \|\| isGuest\)[\s\S]*name="friends"[\s\S]*<\/Stack.Protected>/);
});
