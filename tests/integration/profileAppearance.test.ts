import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { createTestDatabase, createTestUser, databaseRpc } from '../helpers/database.ts';
import { defaultAppearance, decodeProfileAppearance, visibleProfileAppearance } from '../../src/lib/profileAppearance.ts';
import type { SavedProfileAppearance } from '../../src/lib/profileAppearance.ts';

const owner = '00000000-0000-4000-8000-000000000981', other = '00000000-0000-4000-8000-000000000982';
const hash = createHash('sha256').update(owner).digest('hex');

test('profile appearance requires paid VIP, is private and cannot change progress or another account', async t => {
  const db = await createTestDatabase(); t.after(() => db.close());
  await createTestUser(db, owner, 'visual_vip'); await createTestUser(db, other, 'visual_normal');
  const defaults = decodeProfileAppearance(await databaseRpc(db, owner, 'learning_profile_appearance'), owner);
  assert.deepEqual(defaults, { owner, ...defaultAppearance, vip: false });
  await assert.rejects(databaseRpc(db, owner, 'learning_profile_appearance', { p_frame: 'gold' }), /vip_required/);
  await db.query("insert into referral_benefits values($1,now()+interval '3 days')", [owner]);
  await assert.rejects(databaseRpc(db, owner, 'learning_profile_appearance', { p_background: 'sky' }), /vip_required/);
  await db.query("select store_play_subscription($1,'appearance-paid-token',$2,'arca_vip','mensal','SUBSCRIPTION_STATE_ACTIVE',now()+interval '30 days',now(),true)", [owner, hash]);
  const before = (await db.query('select * from profiles where id=$1', [owner])).rows;
  const value = { p_frame: 'gold', p_background: 'garden', p_badge: false };
  const saved = await databaseRpc<SavedProfileAppearance>(db, owner, 'learning_profile_appearance', value);
  assert.equal(saved.vip, true); assert.equal(saved.frame, 'gold'); assert.equal(saved.background, 'garden'); assert.equal(saved.showBadge, false);
  assert.deepEqual(await databaseRpc(db, owner, 'learning_profile_appearance'), saved);
  assert.deepEqual((await db.query('select * from profiles where id=$1', [owner])).rows, before);
  assert.equal((await databaseRpc<SavedProfileAppearance>(db, other, 'learning_profile_appearance')).frame, 'classic');
  await assert.rejects(databaseRpc(db, other, 'learning_profile_appearance', { p_owner: owner, ...value }), /does not exist/);
  await assert.rejects(databaseRpc(db, null, 'learning_profile_appearance'), /permission denied/);
  await assert.rejects(db.transaction(async tx => { await tx.exec('set local role authenticated'); await tx.exec('select * from profile_appearance'); }), /permission denied/);
  await assert.rejects(db.transaction(async tx => { await tx.exec('set local role authenticated'); await tx.exec("update profile_appearance set frame_key='gold'"); }), /permission denied/);
  await assert.rejects(databaseRpc(db, owner, 'learning_profile_appearance', { p_frame: 'injected' }), /appearance_invalid/);
  assert.deepEqual(await databaseRpc(db, owner, 'learning_profile_appearance'), saved);
  await db.query('delete from auth.users where id=$1', [owner]);
  assert.equal((await db.query('select * from profile_appearance')).rows.length, 0);
});

test('expired VIP keeps its saved choices but hides premium styling, can reset for free and recovers after renewal', async t => {
  const db = await createTestDatabase(); t.after(() => db.close());
  await createTestUser(db, owner, 'visual_expiry');
  await db.query("select store_play_subscription($1,'appearance-expiry-token',$2,'arca_vip','anual','SUBSCRIPTION_STATE_ACTIVE',now()+interval '1 year',now(),true)", [owner, hash]);
  await databaseRpc(db, owner, 'learning_profile_appearance', { p_frame: 'starlight', p_background: 'stars', p_badge: true });
  await db.query("update play_subscriptions set verified_at=now()-interval '25 hours' where user_id=$1", [owner]);
  const expired = await databaseRpc<SavedProfileAppearance>(db, owner, 'learning_profile_appearance');
  assert.equal(expired.vip, false); assert.equal(expired.frame, 'starlight');
  assert.deepEqual(visibleProfileAppearance(expired, expired.vip), { ...defaultAppearance, showBadge: false });
  await assert.rejects(databaseRpc(db, owner, 'learning_profile_appearance', { p_background: 'sky' }), /vip_required/);
  await db.query('update play_subscriptions set verified_at=now() where user_id=$1', [owner]);
  const renewed = await databaseRpc<SavedProfileAppearance>(db, owner, 'learning_profile_appearance');
  assert.equal(visibleProfileAppearance(renewed, renewed.vip).frame, 'starlight');
  await db.query("update play_subscriptions set state='SUBSCRIPTION_STATE_ON_HOLD' where user_id=$1", [owner]);
  const reset = await databaseRpc<SavedProfileAppearance>(db, owner, 'learning_profile_appearance', { p_frame: 'classic', p_background: 'plain', p_badge: false });
  assert.equal(reset.vip, false); assert.equal(reset.frame, 'classic'); assert.equal(reset.background, 'plain'); assert.equal(reset.showBadge, false);
});
