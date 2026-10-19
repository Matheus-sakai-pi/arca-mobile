import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDatabase, createTestUser, databaseRpc } from '../helpers/database.ts';
import { initialUnit } from '../../src/data/lessons.ts';
import { answersFor } from '../learningFixtures.ts';
import { decodeEnergy } from '../../src/lib/energy.ts';
import { decodeMembership, type Membership } from '../../src/lib/membership.ts';

const owner = '00000000-0000-4000-8000-000000000961', friend = '00000000-0000-4000-8000-000000000962';
const device = 'a'.repeat(64), otherDevice = 'b'.repeat(64);
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const lesson = initialUnit.lessons[0]!;
async function finish(db: PGlite, who: string, attempt: string) {
  await databaseRpc(db, who, 'learning_battery', { p_action: 'open', p_lesson: lesson.id, p_attempt: attempt });
  for (const [turn, q] of lesson.questions.entries()) await databaseRpc(db, who, 'learning_battery', {
    p_action: 'answer', p_lesson: lesson.id, p_attempt: attempt, p_question: q.id, p_turn: turn, p_answer: q.correctAnswer,
  });
  return databaseRpc<{ result: { xpEarned: number; vipBonus?: number } }>(db, who, 'complete_learning_lesson', { p_lesson_id: lesson.id, p_attempt_id: attempt, p_answers: answersFor(lesson) });
}
async function invite(db: PGlite, who: string, code: string, phone: string, consent = true) {
  await db.query('insert into auth.users values($1,$2,$3,null)', [who, JSON.stringify({ username: `ref_${who.slice(-3)}`, referral_code: code, referral_device: phone, referral_consent: consent }), `${who}@example.test`]);
}

test('VIP is server-owned: unlimited still requires answer receipts, +10% XP once, expiry and avatar protection', async t => {
  const db = await createTestDatabase(undefined, { energyEnabled: true }); t.after(() => db.close());
  await createTestUser(db, owner, 'vip_um'); await createTestUser(db, friend, 'vip_dois');
  await assert.rejects(databaseRpc(db, owner, 'store_play_subscription', { p_user: owner, p_token: 'fake', p_account: hash(owner), p_product: 'arca_vip', p_plan: 'anual', p_state: 'SUBSCRIPTION_STATE_ACTIVE', p_expiry: new Date().toISOString(), p_checked: new Date().toISOString(), p_renew: true }), /permission denied/);
  await db.query("select store_play_subscription($1,$2,$3,'arca_vip','anual','SUBSCRIPTION_STATE_ACTIVE',now()+interval '1 year',now(),true)", [owner, 'test-google-token-0001', hash(owner)]);
  await databaseRpc(db, owner, 'learning_battery');
  await db.query("update battery_wallets set balance=0,refill_at=now()+interval '1 hour' where user_id=$1", [owner]);
  const state = decodeEnergy(await databaseRpc(db, owner, 'learning_battery'), owner);
  assert.equal(state.unlimited, true); assert.equal(state.balance, 0);
  await assert.rejects(databaseRpc(db, owner, 'complete_learning_lesson', { p_lesson_id: lesson.id, p_attempt_id: 'forged', p_answers: answersFor(lesson) }), /battery_receipts_required/);
  const result = await finish(db, owner, 'vip-real');
  assert.equal(result.result.xpEarned, 38); assert.equal(result.result.vipBonus, 3);
  assert.equal((await db.query<{ amount: number }>('select amount from xp_events where user_id=$1', [owner])).rows[0]!.amount, 38);
  assert.equal((await db.query<{ balance: number }>('select balance from battery_wallets where user_id=$1', [owner])).rows[0]!.balance, 0);
  assert.deepEqual((await databaseRpc(db, owner, 'complete_learning_lesson', { p_lesson_id: lesson.id, p_attempt_id: 'vip-real', p_answers: answersFor(lesson) }) as typeof result).result, result.result);
  assert.equal((await finish(db, owner, 'vip-review')).result.xpEarned, 0);
  assert.equal((await db.query<{ xp: number }>('select xp_earned xp from user_daily_activity where user_id=$1', [owner])).rows[0]!.xp, 38);
  assert.equal((await db.query<{ cost: number }>("select sum((receipt->>'charged')::integer)::integer cost from battery_events")).rows[0]!.cost, 0);
  await db.query("update play_subscriptions set verified_at=now()-interval '25 hours' where user_id=$1", [owner]);
  assert.equal((await databaseRpc<Membership>(db, owner, 'learning_membership')).vip, false);
  await assert.rejects(db.transaction(async tx => { await tx.exec('set local role authenticated'); await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [owner]); await tx.query("update profiles set avatar_key='vip-sage' where id=$1", [owner]); }), /vip_required/);
  await assert.rejects(db.query("select store_play_subscription($1,$2,$3,'arca_vip','anual','SUBSCRIPTION_STATE_ACTIVE',now()+interval '1 year',now(),true)", [friend, 'test-google-token-0001', hash(friend)]), /purchase_owner_mismatch/);
  await db.query("update play_subscriptions set state='SUBSCRIPTION_STATE_ON_HOLD',verified_at=now() where user_id=$1", [owner]);
  assert.equal((await databaseRpc<Membership>(db, owner, 'learning_membership')).vip, false);
  await db.query("update play_subscriptions set state='SUBSCRIPTION_STATE_CANCELED' where user_id=$1", [owner]);
  assert.equal((await databaseRpc<Membership>(db, owner, 'learning_membership')).vip, true);
  await db.query("update play_subscriptions set expires_at=now()-interval '1 second' where user_id=$1", [owner]);
  assert.equal((await databaseRpc<Membership>(db, owner, 'learning_membership')).vip, false);
});

test('referral without email confirmation awards both people three days once, stacks and creates friendship with consent', async t => {
  const db = await createTestDatabase(undefined, { energyEnabled: true }); t.after(() => db.close());
  await createTestUser(db, owner, 'convidador');
  const member = decodeMembership(await databaseRpc(db, owner, 'learning_membership', { p_device: device }), owner);
  await invite(db, friend, member.code, otherDevice);
  assert.equal((await db.query("select * from learning_friendships where status='accepted'")).rows.length, 1);
  assert.equal((await databaseRpc<Membership>(db, owner, 'learning_membership')).unlimited, false);
  assert.equal((await databaseRpc<Membership>(db, friend, 'learning_membership')).unlimited, false);
  const result = await finish(db, friend, 'first-real');
  assert.equal(result.result.xpEarned, 35); assert.equal(result.result.vipBonus, undefined);
  const after = await databaseRpc<Membership>(db, owner, 'learning_membership');
  assert.equal(after.vip, false); assert.equal(after.unlimited, true); assert.equal(after.invites.rewarded, 1);
  const expiry = after.referralUntil!;
  const recipient = await databaseRpc<Membership>(db, friend, 'learning_membership');
  assert.equal(recipient.vip, false); assert.equal(recipient.unlimited, true);
  assert.equal(recipient.referralUntil, expiry);
  assert.equal(Date.parse(expiry) - Date.parse(after.serverNow) > 3 * 86400000 - 5000, true);
  assert.equal(Date.parse(expiry) - Date.parse(after.serverNow) <= 3 * 86400000, true);
  await assert.rejects(db.transaction(async tx => { await tx.exec('set local role authenticated'); await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [friend]); await tx.query("update profiles set avatar_key='vip-sage' where id=$1", [friend]); }), /vip_required/);
  assert.equal(await databaseRpc(db, null, 'learning_invite_preview', { p_code: member.code }), '@convidador');
  await databaseRpc(db, owner, 'learning_membership'); await finish(db, friend, 'repeat');
  assert.equal((await databaseRpc<Membership>(db, owner, 'learning_membership')).referralUntil, expiry);
  assert.equal((await databaseRpc<Membership>(db, friend, 'learning_membership')).referralUntil, expiry);
  const second = '00000000-0000-4000-8000-000000000963';
  await invite(db, second, member.code, 'c'.repeat(64)); await finish(db, second, 'second-friend');
  assert.equal(Date.parse((await databaseRpc<Membership>(db, owner, 'learning_membership')).referralUntil!) - Date.parse(expiry), 3 * 86400000);
  assert.equal((await databaseRpc<Membership>(db, second, 'learning_membership')).unlimited, true);
  const repeatedPhone = '00000000-0000-4000-8000-000000000965';
  await invite(db, repeatedPhone, member.code, otherDevice); await finish(db, repeatedPhone, 'reused-device');
  assert.equal((await databaseRpc<Membership>(db, owner, 'learning_membership')).invites.rewarded, 2);
  assert.equal((await databaseRpc<Membership>(db, owner, 'learning_membership')).invites.blocked, 1);
  assert.equal((await databaseRpc<Membership>(db, repeatedPhone, 'learning_membership')).unlimited, false);
  // Receiving an invite and then inviting another friend stacks both kinds of credit.
  const third = '00000000-0000-4000-8000-000000000966';
  await invite(db, third, recipient.code, 'd'.repeat(64)); await finish(db, third, 'friend-invites-next');
  assert.equal(Date.parse((await databaseRpc<Membership>(db, friend, 'learning_membership')).referralUntil!) - Date.parse(expiry), 3 * 86400000);
  assert.equal((await databaseRpc<Membership>(db, third, 'learning_membership')).unlimited, true);
});

test('dual referral rewards are atomic and retries cannot issue either benefit twice', async t => {
  const db = await createTestDatabase(undefined, { energyEnabled: true }); t.after(() => db.close());
  await createTestUser(db, owner, 'atomic_inviter');
  const member = await databaseRpc<Membership>(db, owner, 'learning_membership', { p_device: device });
  await invite(db, friend, member.code, otherDevice);
  await db.exec(`create function public.test_reject_recipient() returns trigger language plpgsql as $$
    begin if new.user_id='${friend}' then raise exception 'test_recipient_unavailable'; end if; return new; end; $$;
    create trigger test_reject_recipient before insert on public.referral_benefits
      for each row execute function public.test_reject_recipient();`);
  await assert.rejects(finish(db, friend, 'retry-dual'), /test_recipient_unavailable/);
  assert.equal((await db.query('select * from referral_benefits')).rows.length, 0);
  assert.equal((await db.query('select * from referral_device_rewards')).rows.length, 0);
  assert.equal((await db.query<{ rewarded_at: string | null }>('select rewarded_at from learning_referrals')).rows[0]!.rewarded_at, null);
  await db.exec('drop trigger test_reject_recipient on public.referral_benefits');
  const args = { p_lesson_id: lesson.id, p_attempt_id: 'retry-dual', p_answers: answersFor(lesson) };
  await databaseRpc(db, friend, 'complete_learning_lesson', args);
  const benefits = (await db.query('select * from referral_benefits order by user_id')).rows;
  assert.equal(benefits.length, 2);
  await databaseRpc(db, friend, 'complete_learning_lesson', args);
  await databaseRpc(db, owner, 'learning_membership'); await databaseRpc(db, friend, 'learning_membership');
  assert.deepEqual((await db.query('select * from referral_benefits order by user_id')).rows, benefits);
});

test('dual-reward upgrade preserves historical receipts and rewards pending invites under the new rule', async t => {
  const migration = '202610180005_referral_rewards_both.sql';
  let previousExpiry = '';
  let code = '';
  const pending = '00000000-0000-4000-8000-000000000967';
  const db = await createTestDatabase(async (name, before) => {
    if (name !== migration) return;
    await createTestUser(before, owner, 'legacy_inviter');
    const member = await databaseRpc<Membership>(before, owner, 'learning_membership', { p_device: device });
    code = member.code;
    await invite(before, friend, code, otherDevice); await finish(before, friend, 'before-upgrade');
    previousExpiry = (await databaseRpc<Membership>(before, owner, 'learning_membership')).referralUntil!;
    await invite(before, pending, code, 'e'.repeat(64));
  }, { energyEnabled: true }); t.after(() => db.close());
  assert.equal((await databaseRpc<Membership>(db, owner, 'learning_membership')).referralUntil, previousExpiry);
  assert.equal((await databaseRpc<Membership>(db, friend, 'learning_membership')).unlimited, false);
  await finish(db, pending, 'after-upgrade');
  assert.equal((await databaseRpc<Membership>(db, pending, 'learning_membership')).unlimited, true);
  assert.equal(Date.parse((await databaseRpc<Membership>(db, owner, 'learning_membership')).referralUntil!) - Date.parse(previousExpiry), 3 * 86400000);
  const sql = await readFile(new URL('../../supabase/migrations/' + migration, import.meta.url), 'utf8');
  assert.equal(await readFile(new URL('../../artifacts/membership/atualizar-convites-duplos.sql', import.meta.url), 'utf8'), sql);
  const benefits = (await db.query('select * from referral_benefits order by user_id')).rows;
  await db.exec(sql);
  await databaseRpc(db, pending, 'learning_membership');
  assert.deepEqual((await db.query('select * from referral_benefits order by user_id')).rows, benefits);
});

test('same phone, reused phone and missing consent cannot mint referral rewards; tables and private helpers stay private', async t => {
  const db = await createTestDatabase(undefined, { energyEnabled: true }); t.after(() => db.close());
  await createTestUser(db, owner, 'protegido');
  const member = await databaseRpc<Membership>(db, owner, 'learning_membership', { p_device: device });
  await invite(db, friend, member.code, device); await finish(db, friend, 'same-device');
  assert.equal((await databaseRpc<Membership>(db, owner, 'learning_membership')).unlimited, false);
  assert.equal((await databaseRpc<Membership>(db, owner, 'learning_membership')).invites.blocked, 1);
  assert.equal((await databaseRpc<Membership>(db, friend, 'learning_membership')).unlimited, false);
  const noConsent = '00000000-0000-4000-8000-000000000964';
  await invite(db, noConsent, member.code, otherDevice, false);
  assert.equal((await db.query('select * from learning_referrals where invitee=$1', [noConsent])).rows.length, 0);
  await finish(db, noConsent, 'no-consent');
  assert.equal((await databaseRpc<Membership>(db, noConsent, 'learning_membership')).unlimited, false);
  await assert.rejects(databaseRpc(db, owner, 'membership_claim_referral', { p_invitee: friend }), /permission denied/);
  await assert.rejects(db.transaction(async tx => { await tx.exec('set local role authenticated'); await tx.exec('select * from play_subscriptions'); }), /permission denied/);
});
