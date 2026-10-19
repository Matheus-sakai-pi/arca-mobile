import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createTestDatabase, createTestUser, databaseRpc } from '../helpers/database.ts';
import { decodePhotoStatus } from '../../src/lib/profilePhoto.ts';

const owner='00000000-0000-4000-8000-000000000741',viewer='00000000-0000-4000-8000-000000000742',admin='00000000-0000-4000-8000-000000000743';
const hash='a'.repeat(64);
async function setup() {
  const db=await createTestDatabase(async(name,db)=>{
    if(name!=='202610180008_profile_photos.sql')return;
    await db.exec(`create schema storage;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
      alter table storage.objects enable row level security;
      grant usage on schema storage to anon,authenticated;
      grant all on storage.objects to anon,authenticated;
      create policy existing_broad_policy on storage.objects for all to anon,authenticated using(true) with check(true);`);
  });
  await createTestUser(db,owner,'photo_vip');await createTestUser(db,viewer,'photo_viewer');await createTestUser(db,admin,'photo_admin');
  await db.query('insert into arca_admins(user_id) values($1)',[admin]);
  await db.query("insert into admin_vip_grants(request_key,user_id,expires_at,reason) values('photo-test',$1,now()+interval '30 days','test')",[owner]);
  const ingest=async(id:string,stage='reserve',who=owner,h=hash)=>(await db.query<{v:string}>('select profile_photo_ingest($1,$2,$3,$4) v',[who,id,h,stage])).rows[0]!.v;
  const submit=async()=>{const id=randomUUID();await ingest(id);await db.query("insert into storage.objects(bucket_id,name) values('profile-photos',$1)",[`${owner}/${id}.jpg`]);await ingest(id,'finish');return id;};
  const status=async(who=owner)=>decodePhotoStatus(await databaseRpc(db,who,'learning_profile_photo'),who);
  const review=async(id:string,action:string,reason='',restrict=false,expected?:string)=>{
    const stamp=expected??(await db.query<{stamp:string}>('select updated_at::text stamp from profile_photo_requests where id=$1',[id])).rows[0]!.stamp;
    return databaseRpc(db,admin,'arca_admin_photo_review',{p_id:id,p_action:action,p_expected:stamp,p_reason:reason,p_restrict:restrict});
  };
  const visible=async(id:string,who:string=viewer,preview=false)=>databaseRpc(db,who,'learning_profile_photo_view',{p_id:id,p_preview:preview});
  const stored=async(who:string)=>db.transaction(async tx=>{await tx.exec('set local role authenticated');await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[who]);return(await tx.query('select name from storage.objects')).rows;});
  return{db,ingest,submit,status,review,visible,stored};
}
test('pending photos remain private, only authorized admins can publish and broad Storage policies cannot bypass fences',async t=>{
  const f=await setup(),{db}=f;t.after(()=>db.close());
  const id=await f.submit(),path=`${owner}/${id}.jpg`;
  assert.equal((await f.status()).latest!.state,'pending');
  assert.equal(await f.visible(id),null);assert.equal(await f.visible(id,viewer,true),null);
  assert.equal(await f.visible(id,owner,true),path);
  assert.equal((await f.stored(viewer)).length,0);assert.equal((await f.stored(owner)).length,1);assert.equal((await f.stored(admin)).length,1);
  assert.equal((await db.transaction(async tx=>{await tx.exec('set local role anon');return(await tx.query('select name from storage.objects')).rows;})).length,0);
  for(const who of [owner,viewer])await assert.rejects(databaseRpc(db,who,'arca_admin_photos'),/admin_required/);
  await assert.rejects(databaseRpc(db,null,'learning_profile_photo'),/permission denied/);
  await assert.rejects(databaseRpc(db,owner,'profile_photo_ingest',{p_user:owner,p_id:randomUUID(),p_hash:hash,p_stage:'reserve'}),/permission denied/);
  for(const sql of ['select * from profile_photo_requests',"update profile_photo_requests set state='approved'",'select * from profile_photo_reports',"insert into storage.objects(bucket_id,name) values('profile-photos','forged.jpg')"]){
    await assert.rejects(db.transaction(async tx=>{await tx.exec('set local role authenticated');await tx.exec(sql);}),/permission denied|row-level security/);
  }
  const update=async(who:string)=>db.transaction(async tx=>{await tx.exec('set local role authenticated');await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[who]);await tx.query('update profiles set avatar_key=$1 where id=$2',[`photo:${id}`,who]);});
  await assert.rejects(update(owner),/photo_not_approved/);
  const page=await databaseRpc<{pending:number;items:{id:string;updatedAt:string}[]}>(db,admin,'arca_admin_photos');
  assert.equal(page.pending,1);const stamp=page.items[0]!.updatedAt;
  await assert.rejects(databaseRpc(db,viewer,'arca_admin_photo_review',{p_id:id,p_action:'approve',p_expected:stamp}),/admin_required/);
  await f.review(id,'approve');
  assert.equal(await f.visible(id),path);assert.equal((await f.stored(viewer)).length,1);
  await assert.rejects(update(viewer),/photo_not_approved/);
  await assert.rejects(f.review(id,'reject','changed',false,stamp),/photo_conflict/);
  await db.query('update admin_vip_grants set revoked_at=now() where user_id=$1',[owner]);
  assert.equal(await f.visible(id),null);assert.equal(await f.visible(id,owner),null);assert.equal((await f.stored(viewer)).length,0);
  // An old public avatar string cannot grant a fresh signed URL after expiry/removal.
  assert.equal((await db.query<{avatar_key:string}>('select avatar_key from profiles where id=$1',[owner])).rows[0]!.avatar_key,`photo:${id}`);
});
test('replacements need another approval; rejection preserves old photo; removal and upload restrictions are enforced',async t=>{
  const f=await setup(),{db}=f;t.after(()=>db.close());
  const first=await f.submit();await f.review(first,'approve');
  const second=await f.submit();assert.ok(await f.visible(first));assert.equal(await f.visible(second),null);
  await assert.rejects(f.review(second,'reject'),/photo_reason_required/);
  await f.review(second,'reject','Violência gráfica',true);
  assert.ok(await f.visible(first));assert.equal((await f.status()).restricted,true);
  await assert.rejects(f.ingest(randomUUID()),/photo_restricted/);
  await f.review(second,'allow_upload');assert.equal((await f.status()).restricted,false);
  const third=await f.submit();await f.review(third,'approve');
  assert.equal(await f.visible(first),null);assert.ok(await f.visible(third));
  await f.review(third,'remove','Uso indevido de imagem',true);
  assert.equal(await f.visible(third),null);assert.equal((await f.status()).restricted,true);
  assert.equal((await db.query<{avatar_key:string}>('select avatar_key from profiles where id=$1',[owner])).rows[0]!.avatar_key,'avatar-01');
  const removed=await databaseRpc<{total:number}>(db,admin,'arca_admin_photos',{p_filter:'removed'});assert.equal(removed.total,1);
  await f.review(third,'allow_upload');
  const fourth=await f.submit();await db.query('update admin_vip_grants set revoked_at=now() where user_id=$1',[owner]);
  await assert.rejects(f.review(fourth,'approve'),/vip_required/);
  await databaseRpc(db,owner,'learning_profile_photo',{p_action:'cancel',p_id:fourth});
  assert.equal((await f.status()).latest!.state,'cancelled');
});
test('server quota, immutable request identity, concurrent retry and cancelled uploads cannot bypass moderation',async t=>{
  const f=await setup(),{db}=f;t.after(()=>db.close());
  const id=randomUUID();assert.equal(await f.ingest(id),'uploading');assert.equal(await f.ingest(id),'busy');
  await assert.rejects(f.ingest(id,'reserve',owner,'b'.repeat(64)),/photo_conflict/);
  await assert.rejects(f.ingest(id,'reserve',viewer),/vip_required/);
  await assert.rejects(f.ingest(randomUUID()),/photo_pending/);
  await databaseRpc(db,owner,'learning_profile_photo',{p_action:'cancel',p_id:id});
  assert.equal(await f.ingest(id,'finish'),'cancelled');
  for(let i=0;i<4;i++){const key=randomUUID();await f.ingest(key);await f.ingest(key,'abort');}
  await assert.rejects(f.ingest(randomUUID()),/photo_limit/);
  await db.exec("update profile_photo_requests set created_at=now()-interval '25 hours'");
  const next=await f.submit();assert.equal(await f.ingest(next),'pending');
  assert.equal((await f.status()).latest!.state,'pending');
});
test('photo reports are private/idempotent, blocking hides photos and stops friendships/challenges, users can unblock',async t=>{
  const f=await setup(),{db}=f;t.after(()=>db.close());
  const id=await f.submit();await f.review(id,'approve');
  await databaseRpc(db,viewer,'learning_friend_action',{p_person:owner,p_action:'request'});
  await databaseRpc(db,owner,'learning_friend_action',{p_person:viewer,p_action:'accept'});
  await databaseRpc(db,viewer,'learning_challenge_create_ten',{p_friend:owner,p_key:'block-pending-challenge'});
  await databaseRpc(db,viewer,'learning_photo_safety',{p_id:id,p_action:'report',p_reason:'sexual'});
  await databaseRpc(db,viewer,'learning_photo_safety',{p_id:id,p_action:'report',p_reason:'other'});
  assert.equal((await db.query('select * from profile_photo_reports')).rows.length,1);
  assert.equal((await databaseRpc<{total:number}>(db,admin,'arca_admin_photos',{p_filter:'reported'})).total,1);
  await databaseRpc(db,viewer,'learning_photo_safety',{p_id:id,p_action:'block'});
  assert.equal(await f.visible(id),null);assert.equal((await f.stored(viewer)).length,0);
  assert.equal((await db.query('select * from learning_friendships')).rows.length,0);
  assert.equal((await db.query<{status:string}>('select status from learning_challenges')).rows[0]!.status,'cancelled');
  await assert.rejects(databaseRpc(db,viewer,'learning_friend_action',{p_person:owner,p_action:'request'}),/user_blocked/);
  const blocked=await databaseRpc<{id:string;name:string}[]>(db,viewer,'learning_photo_blocks');assert.equal(blocked[0]!.id,owner);
  await databaseRpc(db,viewer,'learning_photo_blocks',{p_user:owner});assert.ok(await f.visible(id));
  await databaseRpc(db,viewer,'learning_friend_action',{p_person:owner,p_action:'request'});
  await db.query('delete from auth.users where id=$1',[owner]);
  assert.equal((await db.query('select * from profile_photo_requests')).rows.length,0);assert.equal((await db.query('select * from profile_photo_reports')).rows.length,0);
  assert.equal((await f.stored(viewer)).length,0);
});
test('ready SQL matches the photo migration and contains no account-specific grant or secret',async()=>{
  const migration=await readFile(new URL('../../supabase/migrations/202610180008_profile_photos.sql',import.meta.url),'utf8');
  const ready=await readFile(new URL('../../artifacts/membership/ativar-fotos-perfil.sql',import.meta.url),'utf8');
  assert.equal(ready,migration);assert.doesNotMatch(ready,/service_role_key|PRIVATE KEY|@gmail\.com/);
});
