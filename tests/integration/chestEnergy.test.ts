import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { CHEST_ENERGY_CONFIG as config, ENERGY_CONFIG } from '../../src/config/energy.ts';
import { initialUnit, learningUnits } from '../../src/data/lessons.ts';
import { decodeEnergy } from '../../src/lib/energy.ts';
import { createTestDatabase, createTestUser, databaseRpc } from '../helpers/database.ts';
import { answersFor } from '../learningFixtures.ts';

const owner = '00000000-0000-4000-8000-000000000901', other = '00000000-0000-4000-8000-000000000902';
const firstUnit = learningUnits[0]!, secondUnit = learningUnits[1]!;
test('chest SQL is account-bound, requires real halfway completion and grants a random bonus exactly once', async t => {
  const db = await createTestDatabase(); t.after(() => db.close());
  await createTestUser(db, owner, 'bau_um'); await createTestUser(db, other, 'bau_dois');
  const call = async (action = 'chest_status', unit = firstUnit.id, who = owner) => decodeEnergy(await databaseRpc(db, who, 'learning_battery', { p_action: action, p_lesson: unit }), who);
  const locked = await call();
  assert.equal(locked.chest!.target, 5); assert.equal(locked.chest!.eligible, false);
  await assert.rejects(call('chest_claim'), /chest_locked/);
  for (const lesson of firstUnit.lessons.slice(0, 5)) {
    await databaseRpc(db, owner, 'learning_energy_begin', { p_lesson: lesson.id });
    await databaseRpc(db, owner, 'complete_learning_lesson', { p_lesson_id: lesson.id, p_answers: answersFor(lesson), p_attempt_id: `setup-${lesson.id}` });
  }
  const full = await call(); assert.equal(full.chest!.eligible, true);
  await assert.rejects(call('chest_claim'), /chest_battery_full/);
  assert.equal((await db.query('select * from battery_unit_chests')).rows.length, 0);
  await db.query("update battery_wallets set balance=10,refill_at=now()+interval '1 hour' where user_id=$1", [owner]);
  const results = await Promise.all([call('chest_claim'), call('chest_claim'), call('chest_claim')]);
  const reward = results[0]!.chest!.reward!;
  assert.ok(reward.rolled >= config.min && reward.rolled <= config.max);
  assert.equal(reward.amount, reward.rolled);
  assert.ok(results.every(result => result.balance === 10 + reward.amount && result.chest!.claimed && JSON.stringify(result.chest!.reward) === JSON.stringify(reward)));
  assert.equal((await db.query('select * from battery_unit_chests')).rows.length, 1);
  assert.equal((await call()).balance, 10 + reward.amount);
  assert.equal((await call('chest_status', firstUnit.id, other)).chest!.claimed, false);
  await assert.rejects(call('chest_claim', firstUnit.id, other), /chest_locked/);
  await assert.rejects(call('chest_claim', secondUnit.id), /chest_locked/);
  await assert.rejects(call('chest_claim', 'not-a-unit'), /content_unavailable/);
  const sql = await readFile(new URL('../../supabase/migrations/202610170003_unit_chest_energy.sql', import.meta.url), 'utf8');
  await db.exec(sql);
  assert.deepEqual((await call('chest_claim')).chest!.reward, reward);
  await assert.rejects(databaseRpc(db, owner, 'learning_battery_before_chests', { p_action: 'status' }), /permission denied/);
  await assert.rejects(db.transaction(async tx => { await tx.exec('set local role authenticated'); await tx.query('select * from battery_unit_chests'); }), /permission denied/);
  await db.query('delete from auth.users where id=$1', [owner]);
  assert.equal((await db.query('select * from battery_unit_chests')).rows.length, 0);
});

test('guest chest requires distinct server-completed lessons and caps the bonus without spending a full-battery chest', async t => {
  const db = await createTestDatabase(); t.after(() => db.close());
  const registration = await databaseRpc<{ guestToken: string }>(db, null, 'learning_battery', { p_action: 'register' });
  const token = registration.guestToken;
  const call = async (args: Record<string, unknown>) => decodeEnergy(await databaseRpc(db, null, 'learning_battery', { ...args, p_guest: token }), 'guest');
  await assert.rejects(databaseRpc(db, null, 'learning_battery', { p_action: 'chest_claim', p_lesson: firstUnit.id }), /battery_guest_required/);
  await assert.rejects(call({ p_action: 'chest_claim', p_lesson: firstUnit.id, p_answer: { completed: 10 } }), /chest_locked/);
  for (const [index, lesson] of firstUnit.lessons.slice(0, 5).entries()) {
    const attempt = `guest-${index}`;
    await call({ p_action: 'open', p_lesson: lesson.id, p_attempt: attempt });
    for (const [turn, question] of lesson.questions.entries()) await call({ p_action: 'answer', p_lesson: lesson.id, p_attempt: attempt, p_question: question.id, p_answer: question.correctAnswer, p_turn: turn });
    await call({ p_action: 'finish', p_lesson: lesson.id, p_attempt: attempt });
    if (index === 0) {
      await call({ p_action: 'finish', p_lesson: lesson.id, p_attempt: attempt });
      assert.equal((await call({ p_action: 'chest_status', p_lesson: firstUnit.id })).chest!.completed, 1);
    }
  }
  await assert.rejects(call({ p_action: 'chest_claim', p_lesson: firstUnit.id }), /chest_battery_full/);
  await db.query(`update battery_wallets set balance=${ENERGY_CONFIG.capacity - 2},refill_at=now()+interval '1 hour' where guest_hash is not null`);
  const claimed = await call({ p_action: 'chest_claim', p_lesson: firstUnit.id });
  assert.equal(claimed.chest!.completed, 5); assert.equal(claimed.chest!.reward!.amount, 2);
  assert.ok(claimed.chest!.reward!.rolled >= config.min && claimed.chest!.reward!.rolled <= config.max);
  assert.equal(claimed.balance, ENERGY_CONFIG.capacity); assert.equal(claimed.nextRefillAt, null);
  assert.deepEqual((await call({ p_action: 'chest_claim', p_lesson: firstUnit.id })).chest, claimed.chest);
  const foreign = await databaseRpc<{ guestToken: string }>(db, null, 'learning_battery', { p_action: 'register' });
  const foreignState = decodeEnergy(await databaseRpc(db, null, 'learning_battery', { p_action: 'chest_status', p_lesson: firstUnit.id, p_guest: foreign.guestToken }), 'guest');
  assert.equal(foreignState.chest!.eligible, false); assert.equal(foreignState.chest!.claimed, false);
  const first = initialUnit.lessons[0]!;
  assert.equal((await call({ p_action: 'open', p_lesson: first.id, p_attempt: 'review' })).session!.nextTurn, 0);
});
