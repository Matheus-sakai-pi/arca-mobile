import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialUnit } from '../../src/data/lessons.ts';
// Historical v1 upgrade coverage runs against its actual migration boundary.
import { decodeEnergy } from '../../src/lib/legacyEnergy.ts';
import { createTestDatabase, createTestUser, databaseRpc } from '../helpers/database.ts';
import { answersFor } from '../learningFixtures.ts';

test('SQL energy: enabled for everyone from lesson one, atomic starts, guarded completion, recovery, admin and deletion', async t => {
  const db = await createTestDatabase(undefined, { energyEnabled: true, through: '202610160005_push_notifications.sql' }); t.after(() => db.close());
  const owner = '00000000-0000-4000-8000-000000000401', other = '00000000-0000-4000-8000-000000000402';
  await createTestUser(db, owner, 'energia_um'); await createTestUser(db, other, 'energia_dois');
  const rpc = <T = unknown>(name: string, args: Record<string, unknown> = {}, who: string | null = owner) => databaseRpc<T>(db, who, name, args);
  const state = async (lesson?: string) => decodeEnergy(await rpc('learning_energy_status', lesson ? { p_lesson: lesson } : {}), owner);
  const finish = (index: number, attempt = `finish-${index}`) => rpc('complete_learning_lesson', { p_lesson_id: initialUnit.lessons[index]!.id, p_answers: answersFor(initialUnit.lessons[index]!), p_attempt_id: attempt });
  assert.equal((await state()).enabled, true);
  assert.equal(decodeEnergy(await rpc('learning_energy_status', { p_lesson: initialUnit.lessons[0]!.id }, other), other).cost, 1);
  assert.equal(await rpc('learning_energy_public', {}, null), true);
  await assert.rejects(finish(0), /energy_start_required/);
  for (let n = 0; n < 3; n++) { await rpc('learning_energy_begin', { p_lesson: initialUnit.lessons[n]!.id }); await finish(n); }
  assert.equal((await state()).balance, 2);
  await assert.rejects(finish(3), /energy_start_required/);
  assert.equal((await db.query("select * from lesson_attempts where attempt_key='finish-3'")).rows.length, 0);
  const fourth = initialUnit.lessons[3]!.id;
  await Promise.all(Array.from({ length: 5 }, () => rpc('learning_energy_begin', { p_lesson: fourth })));
  assert.equal((await state()).balance, 1);
  await finish(3); await finish(3, 'review-four'); assert.equal((await state()).balance, 1);
  await assert.rejects(rpc('learning_energy_begin', { p_lesson: initialUnit.lessons[5]!.id }), /lesson_locked/);
  assert.equal((await state()).balance, 1);
  await db.query("update learning_energy_wallets set balance=0,refill_at=now()+interval '4 hours' where user_id=$1", [owner]);
  assert.equal((await rpc<{ allowed: boolean }>('learning_energy_begin', { p_lesson: initialUnit.lessons[4]!.id })).allowed, false);
  assert.equal((await rpc<{ allowed: boolean }>('learning_energy_begin', { p_lesson: fourth })).allowed, true);
  await db.query("update learning_energy_wallets set refill_at=now()-interval '4 hours 1 minute' where user_id=$1", [owner]);
  assert.equal((await state()).balance, 2);
  await db.query("update learning_energy_wallets set refill_at=now()-interval '40 hours' where user_id=$1", [owner]);
  assert.equal((await state()).balance, 5); assert.equal((await state()).nextRefillAt, null);
  await assert.rejects(rpc('arca_admin_energy'), /admin_required/);
  await assert.rejects(rpc('learning_energy_status', {}, null), /permission denied/);
  for (const table of ['learning_energy_wallets', 'learning_energy_access', 'learning_energy_config', 'learning_energy_daily']) await assert.rejects(db.transaction(async tx => { await tx.exec('set local role authenticated'); await tx.query(`select * from ${table}`); }), /permission denied/);
  await db.query('insert into arca_admins(user_id) values($1)', [other]);
  const admin = await rpc<{ updatedAt: string; paidStarts7: number; blockedUsers7: number }>('arca_admin_energy', {}, other);
  assert.equal(admin.paidStarts7, 4); assert.equal(admin.blockedUsers7, 1);
  await rpc('arca_admin_energy_update', { p_enabled: false, p_rollout: 100, p_expected: admin.updatedAt }, other);
  await assert.rejects(rpc('arca_admin_energy_update', { p_enabled: true, p_rollout: 100, p_expected: admin.updatedAt }, other), /energy_config_conflict/);
  assert.equal((await state()).enabled, false);
  await db.query('delete from auth.users where id=$1', [owner]);
  assert.equal((await db.query('select * from learning_energy_wallets where user_id=$1', [owner])).rows.length, 0);
});

test('energy migration preserves a server start from the previous app and cohort selection is stable', async t => {
  const owner = '00000000-0000-4000-8000-000000000421';
  const fourth = initialUnit.lessons[3]!;
  const db = await createTestDatabase(async (file, database) => {
    if (file !== '202610160003_learning_energy.sql') return;
    await createTestUser(database, owner, 'energia_legacy');
    for (const lesson of initialUnit.lessons.slice(0, 3)) await databaseRpc(database, owner, 'complete_learning_lesson', { p_lesson_id: lesson.id, p_answers: answersFor(lesson), p_attempt_id: `legacy-${lesson.id}` });
    await databaseRpc(database, owner, 'start_learning_lesson', { p_lesson_id: fourth.id });
  }, { through: '202610160005_push_notifications.sql' }); t.after(() => db.close());
  await db.exec('update learning_energy_config set enabled=true');
  const value = decodeEnergy(await databaseRpc(db, owner, 'learning_energy_begin', { p_lesson: fourth.id }), owner);
  assert.equal(value.balance, 5); assert.equal(value.reserved, true);
  await databaseRpc(db, owner, 'complete_learning_lesson', { p_lesson_id: fourth.id, p_answers: answersFor(fourth), p_attempt_id: 'legacy-finish-four' });
  assert.equal((await db.query<{ xp_total: number }>('select xp_total from profiles where id=$1', [owner])).rows[0]!.xp_total, 140);
  await db.exec('update learning_energy_config set rollout=10');
  const sample = () => db.query<{ id: string; enabled: boolean }>("select n::text id,public.energy_applies(('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid) enabled from generate_series(1,100)n order by n");
  assert.deepEqual((await sample()).rows, (await sample()).rows);
  const count = (await sample()).rows.filter(row => row.enabled).length; assert.ok(count > 0 && count < 100);
  assert.equal(await databaseRpc(db, null, 'learning_energy_public'), false);
});

test('guest import can only reduce account energy and cannot refill repeatedly', async t => {
  const db = await createTestDatabase(undefined, { through: '202610160005_push_notifications.sql' }); t.after(() => db.close());
  const owner = '00000000-0000-4000-8000-000000000411'; await createTestUser(db, owner, 'energia_import');
  const rpc = (name: string, args: Record<string, unknown> = {}) => databaseRpc(db, owner, name, args);
  await rpc('import_guest_progress', { p_source_id: 'energy-visitor', p_completed_ids: initialUnit.lessons.slice(0, 3).map(l => l.id), p_xp: 90 });
  const imported = decodeEnergy(await rpc('learning_energy_status', { p_guest_source: 'energy-visitor', p_guest_balance: 2, p_guest_wait: 3600 }), owner);
  assert.equal(imported.balance, 2);
  assert.equal(decodeEnergy(await rpc('learning_energy_status', { p_guest_source: 'energy-visitor', p_guest_balance: 5, p_guest_wait: 0 }), owner).balance, 2);
  assert.equal(decodeEnergy(await rpc('learning_energy_status', { p_guest_source: 'forged', p_guest_balance: 0, p_guest_wait: 1 }), owner).balance, 2);
});
