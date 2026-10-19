import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createTestDatabase, createTestUser, databaseRpc } from '../helpers/database.ts';
import { decodeMembership, type Membership } from '../../src/lib/membership.ts';
import { decodeEnergy } from '../../src/lib/energy.ts';
import { initialUnit } from '../../src/data/lessons.ts';
import { answersFor } from '../learningFixtures.ts';
import type { SavedProfileAppearance } from '../../src/lib/profileAppearance.ts';

const owner = '00000000-0000-4000-8000-000000000991';
const other = '00000000-0000-4000-8000-000000000992';
const email = 'matheussakai23032001@gmail.com';
const grant = () => readFile(new URL('../../artifacts/membership/conceder-vip-teste-30-dias.sql', import.meta.url), 'utf8');
const upgrade = () => readFile(new URL('../../supabase/migrations/202610180007_admin_vip.sql', import.meta.url), 'utf8');

test('administrative test VIP targets the exact account, is audited, lasts 30 days and cannot renew on replay', async t => {
  const db = await createTestDatabase(undefined, { energyEnabled: true });
  t.after(() => db.close());
  await createTestUser(db, owner, 'admin_vip');
  await createTestUser(db, other, 'no_admin_vip');
  await db.query('update auth.users set email=$1 where id=$2', [email, owner]);
  const profiles = (await db.query('select * from profiles order by id')).rows;
  const combined = await readFile(new URL('../../artifacts/membership/ativar-vip-teste-30-dias.sql', import.meta.url), 'utf8');
  const normalize = (value: string) => value.replace(/\r\n/g, '\n').trim();
  assert.equal(normalize(combined), normalize((await upgrade()).trimEnd() + '\n\n' + await grant()));
  await db.exec(combined);
  const rows = (await db.query<{ user_id: string; starts_at: Date; expires_at: Date; created_by: string; reason: string }>('select * from admin_vip_grants')).rows;
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.user_id, owner);
  assert.equal(+rows[0]!.expires_at - +rows[0]!.starts_at, 30 * 86400000);
  assert.ok(rows[0]!.created_by);
  assert.ok(rows[0]!.reason);
  const member = decodeMembership(await databaseRpc(db, owner, 'learning_membership'), owner);
  assert.equal(member.vip, true);
  assert.equal(member.unlimited, true);
  assert.equal(member.billingReady, false);
  assert.equal(Date.parse(member.vipUntil!), +rows[0]!.expires_at);
  assert.equal((await databaseRpc<Membership>(db, other, 'learning_membership')).vip, false);
  assert.equal((await db.query('select * from play_subscriptions')).rows.length, 0);
  assert.deepEqual((await db.query('select * from profiles order by id')).rows, profiles);
  await db.exec(combined);
  assert.deepEqual((await db.query('select * from admin_vip_grants')).rows, rows);
  const appearance = await databaseRpc<SavedProfileAppearance>(db, owner, 'learning_profile_appearance', { p_frame: 'gold', p_background: 'garden' });
  assert.equal(appearance.vip, true);
  await db.transaction(async tx => {
    await tx.exec('set local role authenticated');
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [owner]);
    await tx.query("update profiles set avatar_key='vip-sage' where id=$1", [owner]);
  });
  await databaseRpc(db, owner, 'learning_battery');
  await db.query("update battery_wallets set balance=0,refill_at=now()+interval '1 hour' where user_id=$1", [owner]);
  assert.equal(decodeEnergy(await databaseRpc(db, owner, 'learning_battery'), owner).unlimited, true);
  const lesson = initialUnit.lessons[0]!;
  const args = { p_lesson_id: lesson.id, p_attempt_id: 'admin-vip-lesson', p_answers: answersFor(lesson) };
  await assert.rejects(databaseRpc(db, owner, 'complete_learning_lesson', args), /battery_receipts_required/);
  await databaseRpc(db, owner, 'learning_battery', { p_action: 'open', p_lesson: lesson.id, p_attempt: args.p_attempt_id });
  for (const [turn, q] of lesson.questions.entries()) {
    await databaseRpc(db, owner, 'learning_battery', { p_action: 'answer', p_lesson: lesson.id, p_attempt: args.p_attempt_id, p_question: q.id, p_turn: turn, p_answer: q.correctAnswer });
  }
  const completion = await databaseRpc<{ result: { xpEarned: number; vipBonus: number } }>(db, owner, 'complete_learning_lesson', args);
  assert.equal(completion.result.xpEarned, 38);
  assert.equal(completion.result.vipBonus, 3);
  assert.deepEqual((await databaseRpc<typeof completion>(db, owner, 'complete_learning_lesson', args)).result, completion.result);
  assert.equal(decodeEnergy(await databaseRpc(db, owner, 'learning_battery'), owner).balance, 0);
  const revoke = await readFile(new URL('../../artifacts/membership/revogar-vip-teste.sql', import.meta.url), 'utf8');
  await db.exec(revoke);
  await db.exec(await grant());
  assert.equal((await databaseRpc<Membership>(db, owner, 'learning_membership')).vip, false);
  assert.equal(decodeEnergy(await databaseRpc(db, owner, 'learning_battery'), owner).unlimited, false);
  assert.equal((await databaseRpc<SavedProfileAppearance>(db, owner, 'learning_profile_appearance')).vip, false);
});

test('app users cannot read or forge administrative grants; expiry and Play verification remain independent', async t => {
  const db = await createTestDatabase();
  t.after(() => db.close());
  await createTestUser(db, owner, 'admin_security');
  for (const role of ['anon', 'authenticated']) {
    for (const sql of [
      'select * from admin_vip_grants',
      `insert into admin_vip_grants(request_key,user_id,expires_at,reason) values('fake','${owner}',now()+interval '30 days','fake')`,
      'update admin_vip_grants set revoked_at=null',
      'delete from admin_vip_grants',
      `select membership_admin_vip_until('${owner}')`,
      `select membership_vip_until('${owner}')`,
    ]) {
      await assert.rejects(db.transaction(async tx => { await tx.exec(`set local role ${role}`); await tx.exec(sql); }), /permission denied/);
    }
  }
  await db.query("insert into admin_vip_grants(request_key,user_id,starts_at,expires_at,reason) values('future',$1,now()+interval '1 day',now()+interval '31 days','future'),('expired',$1,now()-interval '31 days',now()-interval '1 day','expired')", [owner]);
  assert.equal((await databaseRpc<Membership>(db, owner, 'learning_membership')).vip, false);
  await db.query("insert into admin_vip_grants(request_key,user_id,expires_at,reason) values('active',$1,now()+interval '30 days','test')", [owner]);
  const hash = createHash('sha256').update(owner).digest('hex');
  await db.query("select store_play_subscription($1,'admin-independent-google-token',$2,'arca_vip','anual','SUBSCRIPTION_STATE_ACTIVE',now()+interval '1 year',now(),true)", [owner, hash]);
  let member = await databaseRpc<Membership>(db, owner, 'learning_membership');
  assert.ok(Date.parse(member.vipUntil!) - Date.parse(member.serverNow) > 360 * 86400000);
  await db.exec("update admin_vip_grants set revoked_at=now() where request_key='active'");
  assert.equal((await databaseRpc<Membership>(db, owner, 'learning_membership')).vip, true);
  await db.exec("update play_subscriptions set verified_at=now()-interval '25 hours'");
  assert.equal((await databaseRpc<Membership>(db, owner, 'learning_membership')).vip, false);
  await db.exec("update admin_vip_grants set revoked_at=null where request_key='active'");
  member = await databaseRpc<Membership>(db, owner, 'learning_membership');
  assert.equal(member.vip, true);
  assert.ok(Date.parse(member.vipUntil!) - Date.parse(member.serverNow) <= 30 * 86400000);
  await db.exec("update admin_vip_grants set starts_at=now()-interval '31 days',expires_at=now()-interval '1 day' where request_key='active'");
  assert.equal((await databaseRpc<Membership>(db, owner, 'learning_membership')).vip, false);
  await db.query('delete from auth.users where id=$1', [owner]);
  assert.equal((await db.query('select * from admin_vip_grants where user_id is not null')).rows.length, 0);
  assert.equal((await db.query('select * from admin_vip_grants')).rows.length, 3);
});

test('ready-to-run grant fails closed for missing, ambiguous or recreated accounts', async t => {
  const db = await createTestDatabase();
  t.after(() => db.close());
  const runGrant = async () => {
    try { await db.exec(await grant()); }
    catch (error) { await db.exec('rollback'); throw error; }
  };
  await assert.rejects(runGrant(), /Conta nao encontrada/);
  assert.equal((await db.query('select * from admin_vip_grants')).rows.length, 0);
  await createTestUser(db, owner, 'owner_missing_email');
  await createTestUser(db, other, 'other_same_email');
  await db.query('update auth.users set email=$1 where id in ($2,$3)', [email, owner, other]);
  await assert.rejects(runGrant(), /email ambiguo/);
  await db.query('update auth.users set email=$1 where id=$2', ['different@example.test', other]);
  await runGrant();
  await db.query('delete from auth.users where id=$1', [owner]);
  await db.query('update auth.users set email=$1 where id=$2', [email, other]);
  await assert.rejects(runGrant(), /Concessao anterior pertence/);
  assert.equal((await databaseRpc<Membership>(db, other, 'learning_membership')).vip, false);
  assert.equal((await db.query('select * from admin_vip_grants')).rows.length, 1);
});

test('tester gift grants thirty days only to the tester, preserves the owner and cannot renew or transfer', async t => {
  const db = await createTestDatabase();
  t.after(() => db.close());
  const testerEmail = 'matsakteste@gmail.com';
  const third = '00000000-0000-4000-8000-000000000993';
  const combined = await readFile(new URL('../../artifacts/membership/ativar-vip-testador-30-dias.sql', import.meta.url), 'utf8');
  const testerGrant = await readFile(new URL('../../artifacts/membership/conceder-vip-testador-30-dias.sql', import.meta.url), 'utf8');
  const normalize = (value: string) => value.replace(/\r\n/g, '\n').trim();
  assert.equal(normalize(combined), normalize((await upgrade()).trimEnd() + '\n\n' + testerGrant));
  const run = async () => {
    try { await db.exec(combined); }
    catch (error) { await db.exec('rollback'); throw error; }
  };
  await createTestUser(db, owner, 'original_vip_owner');
  await db.query('update auth.users set email=$1 where id=$2', [email, owner]);
  await db.exec(await grant());
  const original = (await db.query('select * from admin_vip_grants where user_id=$1', [owner])).rows;
  await assert.rejects(run(), /Conta nao encontrada/);
  await createTestUser(db, other, 'vip_tester');
  await createTestUser(db, third, 'not_vip_tester');
  await db.query('update auth.users set email=$1 where id in ($2,$3)', [testerEmail, other, third]);
  await assert.rejects(run(), /email ambiguo/);
  assert.deepEqual((await db.query('select * from admin_vip_grants')).rows, original);
  await db.query('update auth.users set email=$1 where id=$2', ['not-tester@example.test', third]);
  const profiles = (await db.query('select * from profiles order by id')).rows;
  await run();
  const tester = decodeMembership(await databaseRpc(db, other, 'learning_membership'), other);
  assert.equal(tester.vip, true);
  assert.equal(tester.unlimited, true);
  assert.equal(tester.billingReady, false);
  const row = (await db.query<{ starts_at: Date; expires_at: Date; reason: string }>('select * from admin_vip_grants where user_id=$1', [other])).rows[0]!;
  assert.equal(+row.expires_at - +row.starts_at, 30 * 86400000);
  assert.match(row.reason, /testador/);
  assert.equal(Date.parse(tester.vipUntil!), +row.expires_at);
  assert.equal((await databaseRpc<Membership>(db, third, 'learning_membership')).vip, false);
  assert.deepEqual((await db.query('select * from profiles order by id')).rows, profiles);
  assert.equal((await db.query('select * from play_subscriptions')).rows.length, 0);
  const receipts = (await db.query('select * from admin_vip_grants order by request_key')).rows;
  await run();
  assert.deepEqual((await db.query('select * from admin_vip_grants order by request_key')).rows, receipts);
  assert.deepEqual((await db.query('select * from admin_vip_grants where user_id=$1', [owner])).rows, original);
  await db.query('update admin_vip_grants set revoked_at=now() where user_id=$1', [other]);
  await run();
  assert.equal((await databaseRpc<Membership>(db, other, 'learning_membership')).vip, false);
  assert.equal((await databaseRpc<Membership>(db, owner, 'learning_membership')).vip, true);
  await db.query('delete from auth.users where id=$1', [other]);
  await db.query('update auth.users set email=$1 where id=$2', [testerEmail, third]);
  await assert.rejects(run(), /Concessao anterior pertence/);
  assert.equal((await databaseRpc<Membership>(db, third, 'learning_membership')).vip, false);
});
