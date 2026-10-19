import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import jpeg from 'jpeg-js';
import { PHOTO_CONFIG, decodePhotoStatus, photoAvatarId } from '../../src/lib/profilePhoto.ts';
import { PHOTO_LIMITS, createPhotoUploadHandler, type PhotoUploadDependencies } from '../../supabase/functions/profile-photo/handler.ts';
import { sanitizeProfileJPEG } from '../../supabase/functions/profile-photo/raster.ts';
import { clearProfilePhotos } from '../../supabase/functions/delete-account/photos.ts';

const owner = '00000000-0000-4000-8000-000000000751', id = '00000000-0000-4000-8000-000000000752';
const image = () => new Uint8Array(jpeg.encode({ width: 32, height: 32, data: new Uint8Array(32 * 32 * 4).fill(255) }, 85).data);
test('photo contracts accept only scoped receipts and UUID photo references, never arbitrary image URLs', () => {
  assert.equal(photoAvatarId(`photo:${id}`), id);
  for (const key of ['photo:https://bad.test/a.jpg', 'https://bad.test/a.jpg','photo:../secret', 'avatar-01', null]) assert.equal(photoAvatarId(key), null);
  const value = { owner, vip: true, restricted: false, latest: { id, state: 'pending', reason: '', updatedAt: new Date().toISOString() } };
  assert.equal(decodePhotoStatus(value, owner).latest!.state, 'pending');
  for (const v of [{ ...value, owner: id }, { ...value, vip: 'true' }, { ...value, latest: { ...value.latest, state: 'auto-approved' } }]) assert.throws(() => decodePhotoStatus(v, owner));
  assert.equal(PHOTO_CONFIG.bytes, PHOTO_LIMITS.bytes); assert.equal(PHOTO_CONFIG.dimension, PHOTO_LIMITS.dimension);
});
test('server JPEG conversion strips metadata/trailing payloads, rejects SVG, invalid JPEG, non-square and oversized dimensions', () => {
  const raw = image();
  const comment = Buffer.from('private-metadata');
  const annotated = Buffer.concat([raw.subarray(0,2), Buffer.from([255,254,0,comment.length+2]), comment, raw.subarray(2), Buffer.from('TRAILING_PRIVATE_DATA')]);
  const safe = sanitizeProfileJPEG(annotated, jpeg);
  assert.equal(Buffer.from(safe).includes(comment), false);
  assert.equal(Buffer.from(safe).includes(Buffer.from('TRAILING_PRIVATE_DATA')), false);
  assert.equal(jpeg.decode(safe).width, 32);
  for (const bytes of [new TextEncoder().encode('<svg onload="alert(1)"/>'),new Uint8Array([255,216,255,1]),jpeg.encode({width:33,height:32,data:new Uint8Array(33*32*4)},80).data,jpeg.encode({width:513,height:513,data:new Uint8Array(513*513*4)},80).data]) assert.throws(() => sanitizeProfileJPEG(bytes, jpeg), /photo_invalid/);
});
function fixture() {
  const calls: string[] = []; let stage = 'new';
  const deps: PhotoUploadDependencies = {
    authenticate: async token => token === 'real-token' ? owner : null,
    hash: async bytes => createHash('sha256').update(bytes).digest('hex'),
    ingest: async (who, key, hash, action) => { calls.push(`${action}:${who}:${key}`); assert.equal(hash.length,64); if(action==='reserve'){if(stage==='new'){stage='uploading';return stage;}return stage==='uploading'?'busy':stage;} if(action==='finish')stage='pending';if(action==='abort'&&stage==='uploading')stage='cancelled';return stage; },
    sanitize: async bytes => sanitizeProfileJPEG(bytes,jpeg),
    upload: async path => { calls.push(`upload:${path}`);return true; },
    remove: async path => { calls.push(`remove:${path}`); },
  };
  const request = (body: unknown, token = 'real-token') => new Request('https://example.test/functions/v1/profile-photo',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const body = {id,image:Buffer.from(image()).toString('base64'),consent:1};
  return {deps,calls,request,body};
}
test('upload authenticates, requires consent, ignores no nominated owners and never exposes unapproved bytes', async () => {
  const f=fixture(),handler=createPhotoUploadHandler(f.deps);
  assert.equal((await handler(f.request(f.body,'stranger'))).status,401);
  assert.equal((await handler(f.request({...f.body,consent:false}))).status,400);
  assert.equal((await handler(f.request({...f.body,userId:id}))).status,400);
  assert.equal((await handler(f.request({...f.body,image:btoa('<svg/>')}))).status,400);
  assert.equal(f.calls.length,0);
  assert.deepEqual(await (await handler(f.request(f.body))).json(),{owner,id,state:'pending'});
  assert.equal(f.calls.filter(c=>c.startsWith('upload:')).length,1);
  assert.equal((await handler(f.request(f.body))).status,200);
  assert.equal(f.calls.filter(c=>c.startsWith('upload:')).length,1);
  assert.equal(f.calls.some(c=>c.startsWith('remove:')),false);
});
test('upload rate/size limits and concurrent retry fail closed; ambiguous finish never deletes finalized photos', async () => {
  const f=fixture(),handler=createPhotoUploadHandler(f.deps);
  const ingest=f.deps.ingest;
  f.deps.ingest=async()=>{throw new Error('photo_limit');};
  assert.equal((await handler(f.request(f.body))).status,429);
  f.deps.ingest=async()=> 'busy';
  assert.equal((await handler(f.request(f.body))).status,400);
  assert.equal(f.calls.length,0);
  const oversize=f.request({...f.body,image:'A'.repeat(PHOTO_LIMITS.bodyBytes)});
  assert.equal((await handler(oversize)).status,400);
  f.deps.ingest=async(who,key,hash,stage)=>{const state=await ingest(who,key,hash,stage);if(stage==='finish')throw new Error('SECRET_TOKEN');return state;};
  const result=await handler(f.request(f.body));
  assert.equal(result.status,503);assert.doesNotMatch(await result.text(),/SECRET_TOKEN/);
  assert.equal(f.calls.some(c=>c.startsWith('remove:')),false);
  assert.equal((await handler(f.request(f.body))).status,200);
});

test('account deletion drains only the authenticated photo folder, freezes uploads first and stops on errors or traversal', async () => {
  const events:string[]=[];let files=[`${id}.jpg`];
  const deps={freeze:async(who:string)=>{events.push(`freeze:${who}`);return true;},list:async(who:string)=>{events.push(`list:${who}`);return files;},remove:async(paths:string[])=>{events.push(`remove:${paths.join(',')}`);files=[];return true;}};
  assert.equal(await clearProfilePhotos(owner,deps),true);
  assert.equal(events[0],`freeze:${owner}`);assert.ok(events.includes(`remove:${owner}/${id}.jpg`));
  assert.equal(await clearProfilePhotos(owner,{...deps,freeze:async()=>false}),false);
  assert.equal(await clearProfilePhotos(owner,{...deps,list:async()=>null}),false);
  assert.equal(await clearProfilePhotos(owner,{...deps,list:async()=>['../other/private.jpg']}),false);
  assert.equal(await clearProfilePhotos(owner,{...deps,list:async()=>[`${id}.jpg`],remove:async()=>false}),false);
});

test('an ambiguous storage upload is cleaned even when its acknowledgement was lost', async () => {
  const f=fixture();
  f.deps.upload=async()=>false;
  const response=await createPhotoUploadHandler(f.deps)(f.request(f.body));
  assert.equal(response.status,503);
  assert.ok(f.calls.includes(`remove:${owner}/${id}.jpg`));
  assert.ok(f.calls.includes(`abort:${owner}:${id}`));
});
