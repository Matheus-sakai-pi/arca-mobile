import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ENERGY_CONFIG as config } from '../../src/config/energy.ts';
import { initialUnit } from '../../src/data/lessons.ts';
import { decodeEnergy, type EnergyState } from '../../src/lib/energy.ts';
import { evaluateQuestion } from '../../src/lib/questionEngine.ts';
import { createTestDatabase, createTestUser, databaseRpc } from '../helpers/database.ts';
import { answersFor, wrongAnswer } from '../learningFixtures.ts';

test('battery SQL validates answers, charges once, preserves sessions, grants bounded bonuses and protects completion', async t => {
  const db = await createTestDatabase(undefined, { energyEnabled: true }); t.after(() => db.close());
  const owner = '00000000-0000-4000-8000-000000000801', other = '00000000-0000-4000-8000-000000000802';
  await createTestUser(db, owner, 'bateria_um'); await createTestUser(db, other, 'bateria_dois');
  const lesson = initialUnit.lessons[0]!;
  const call = async (args: Record<string, unknown>, who: string | null = owner) => decodeEnergy(await databaseRpc(db, who, 'learning_battery', args), who ?? 'guest');
  let state = await call({ p_action: 'open', p_lesson: lesson.id, p_attempt: 'exercise-one' });
  assert.equal(state.balance, config.capacity); assert.equal(state.session!.nextTurn, 0);
  await assert.rejects(databaseRpc(db, owner, 'complete_learning_lesson', { p_lesson_id: lesson.id, p_attempt_id: 'exercise-one', p_answers: answersFor(lesson) }), /battery_receipts_required/);
  await db.query('update battery_wallets set balance=12,refill_at=now()+$2*interval \'1 second\' where user_id=$1', [owner, config.refillSeconds]);
  const answers = answersFor(lesson); answers[lesson.questions[0]!.id] = wrongAnswer(lesson.questions[0]!);
  for (const [turn, q] of lesson.questions.entries()) {
    state = await call({ p_action: 'answer', p_lesson: lesson.id, p_attempt: 'exercise-one', p_question: q.id, p_answer: answers[q.id], p_turn: turn });
    assert.equal(state.receipt!.charged, q.type === 'content_card' ? 0 : config.exerciseCost);
    if (turn === 0) assert.equal(state.session!.streak, 0);
  }
  const beforeRetry = state.balance;
  const retry = { p_action: 'answer', p_lesson: lesson.id, p_attempt: 'exercise-one', p_question: lesson.questions[0]!.id, p_answer: lesson.questions[0]!.correctAnswer, p_turn: lesson.questions.length };
  const receipts = await Promise.all([call(retry), call(retry), call(retry)]);
  const afterRetry = receipts[0]!.balance;
  assert.ok(receipts.every(value => value.balance === afterRetry && value.receipt!.charged === 0));
  assert.equal(afterRetry, beforeRetry + receipts[0]!.receipt!.bonuses.reduce((sum, bonus) => sum + bonus.amount, 0));
  assert.equal(receipts[0]!.session!.nextQuestionId, null);
  await assert.rejects(call({ ...retry, p_answer: answers[lesson.questions[0]!.id] }), /answer_conflict/);
  await assert.rejects(call({ ...retry, p_turn: 999 }), /answer_order_invalid/);
  await assert.rejects(call(retry, other), /battery_session_required/);
  const bonuses = (await db.query<{ reward_key: string; rolled: number }>('select reward_key,rolled from battery_rewards order by reward_key')).rows;
  assert.deepEqual(bonuses.map(b => b.reward_key), ['streak-10', 'streak-5']);
  assert.ok(bonuses.every(b => b.rolled >= config.streakBonusMin && b.rolled <= config.streakBonusMax));
  await call({ p_action: 'finish', p_lesson: lesson.id, p_attempt: 'exercise-one' });
  await databaseRpc(db, owner, 'complete_learning_lesson', { p_lesson_id: lesson.id, p_attempt_id: 'exercise-one', p_answers: answers });
  const events = await db.query<{ cost: number }>("select sum((receipt->>'charged')::integer)::integer cost from battery_events");
  assert.equal(events.rows[0]!.cost, lesson.questions.filter(q => q.type !== 'content_card').length);
  await assert.rejects(databaseRpc(db, owner, 'complete_learning_lesson_before_battery', { p_lesson_id: lesson.id, p_attempt_id: 'bypass', p_answers: answers }), /permission denied/);
  const after = await call({ p_action: 'open', p_lesson: lesson.id, p_attempt: 'review-new' });
  assert.equal(after.balance, afterRetry);
  assert.equal(after.session!.attemptId, 'review-new');
  await db.query('update battery_wallets set balance=25,refill_at=null where user_id=$1', [owner]);
  for (const [turn, q] of lesson.questions.slice(0, 5).entries()) {
    const value = await call({ p_action: 'answer', p_lesson: lesson.id, p_attempt: 'review-new', p_question: q.id, p_answer: q.correctAnswer, p_turn: turn });
    assert.equal(value.receipt!.charged, config.exerciseCost);
    assert.equal(value.receipt!.bonuses.length, 0);
  }
  assert.equal((await db.query('select * from battery_rewards')).rows.length, 2);
});

test('battery upgrade preserves legacy balance and one reserved draft without retroactive charges or rewards', async t => {
  const owner = '00000000-0000-4000-8000-000000000821';
  const lesson = initialUnit.lessons[0]!;
  const db = await createTestDatabase(async (file, database) => {
    if (file !== '202610170001_exercise_energy.sql') return;
    await createTestUser(database, owner, 'bateria_antiga');
    await databaseRpc(database, owner, 'learning_energy_begin', { p_lesson: lesson.id });
    await databaseRpc(database, owner, 'record_study_session', { p_lesson: lesson.id, p_attempt: 'old-draft' });
  }, { energyEnabled: true }); t.after(() => db.close());
  const resume = Object.fromEntries(lesson.questions.slice(0, 2).map(q => [q.id, q.correctAnswer]));
  const state = decodeEnergy(await databaseRpc(db, owner, 'learning_battery', { p_action: 'open', p_lesson: lesson.id, p_attempt: 'old-draft', p_resume: resume }), owner);
  assert.equal(state.balance, config.capacity * (config.legacyCapacity - 1) / config.legacyCapacity);
  assert.equal(state.session!.legacy, true); assert.equal(state.session!.nextTurn, 2); assert.equal(state.session!.streak, 2);
  assert.equal((await db.query('select * from battery_legacy_attempts where user_id=$1', [owner])).rows.length, 0);
  const next = lesson.questions[2]!;
  const confirmed = decodeEnergy(await databaseRpc(db, owner, 'learning_battery', { p_action: 'answer', p_lesson: lesson.id, p_attempt: 'old-draft', p_question: next.id, p_answer: next.correctAnswer, p_turn: 2 }), owner);
  assert.equal(confirmed.receipt!.charged, 0); assert.equal(confirmed.balance, state.balance);
  assert.equal(confirmed.receipt!.bonuses.length, 0);
});

test('battery SQL: exhaustion, server refill, perfect +5, capped/overflow rewards and guest capabilities', async t => {
  const db = await createTestDatabase(undefined, { energyEnabled: true }); t.after(() => db.close());
  const owner = '00000000-0000-4000-8000-000000000811'; await createTestUser(db, owner, 'bateria_perfeita');
  const lesson = initialUnit.lessons[0]!;
  const call = async (args: Record<string, unknown>, who: string | null = owner) => decodeEnergy(await databaseRpc(db, who, 'learning_battery', args), who ?? 'guest');
  await call({ p_action: 'open', p_lesson: lesson.id, p_attempt: 'perfect' });
  await db.query("update battery_wallets set balance=0,refill_at=now()+interval '1 hour' where user_id=$1", [owner]);
  const first = { p_action: 'answer', p_lesson: lesson.id, p_attempt: 'perfect', p_question: lesson.questions[0]!.id, p_answer: lesson.questions[0]!.correctAnswer, p_turn: 0 };
  const blocked = await call(first); assert.equal(blocked.allowed, false); assert.equal(blocked.session!.nextTurn, 0);
  await db.query("update battery_wallets set refill_at=now()-$2*interval '1 second' where user_id=$1", [owner, config.refillSeconds + 1]);
  assert.equal((await call({ p_action: 'status' })).balance, 2);
  await db.query("update battery_wallets set balance=8,refill_at=now()+interval '1 hour' where user_id=$1", [owner]);
  let state: EnergyState = blocked;
  for (const [turn, q] of lesson.questions.entries()) state = await call({ ...first, p_question: q.id, p_answer: q.correctAnswer, p_turn: turn });
  const rewards = (await db.query<{ reward_key: string; rolled: number; granted: number }>('select reward_key,rolled,granted from battery_rewards order by reward_key')).rows;
  assert.deepEqual(rewards.map(r => r.reward_key), ['perfect', 'streak-10', 'streak-5']);
  assert.equal(rewards[0]!.rolled, config.perfectBonus); assert.equal(rewards[0]!.granted, config.perfectBonus);
  assert.equal(state.balance, 8 - lesson.questions.length + rewards.reduce((sum, r) => sum + r.granted, 0));
  assert.ok(state.balance <= config.capacity);
  await db.query("update battery_wallets set balance=0,refill_at=now()-interval '30 hours' where user_id=$1", [owner]);
  assert.equal((await call({ p_action: 'status' })).balance, config.capacity);
  const raw = await databaseRpc<Record<string, unknown>>(db, null, 'learning_battery', { p_action: 'register' });
  assert.equal(typeof raw.guestToken, 'string');
  const token = raw.guestToken as string;
  const guest = await call({ p_action: 'open', p_guest: token, p_lesson: lesson.id, p_attempt: 'guest' }, null);
  assert.equal(guest.balance, config.capacity);
  const spent = await call({ ...first, p_guest: token, p_attempt: 'guest' }, null); assert.equal(spent.balance, config.capacity - config.exerciseCost);
  await assert.rejects(call({ p_guest: '0'.repeat(64) }, null), /battery_guest_required/);
  for (const table of ['battery_wallets', 'battery_sessions', 'battery_events', 'battery_rewards', 'battery_rules', 'battery_legacy_attempts']) await assert.rejects(db.transaction(async tx => { await tx.exec('set local role anon'); await tx.query(`select * from ${table}`); }), /permission denied/);
  await assert.rejects(databaseRpc(db, owner, 'battery_reward', { p_wallet: '00000000-0000-4000-8000-000000000000', p_lesson: lesson.id, p_key: 'fake', p_min: 99, p_max: 99 }), /permission denied/);
  await db.query("update battery_rules set rules=jsonb_set(rules,'{bonusOverflow}','true')");
  const registered = await databaseRpc<{ guestToken: string }>(db, null, 'learning_battery', { p_action: 'register' });
  await call({ p_action: 'open', p_guest: registered.guestToken, p_lesson: lesson.id, p_attempt: 'overflow' }, null);
  await db.exec("update battery_rules set rules=jsonb_set(jsonb_set(rules,'{streakBonusMin}','8'),'{streakBonusMax}','8')");
  for (const [turn, q] of lesson.questions.slice(0, 5).entries()) state = await call({ ...first, p_guest: registered.guestToken, p_attempt: 'overflow', p_question: q.id, p_answer: q.correctAnswer, p_turn: turn }, null);
  assert.equal(state.balance, config.capacity - 5 + 8); assert.equal(state.nextRefillAt, null);
  await db.query('delete from auth.users where id=$1', [owner]);
  assert.equal((await db.query('select * from battery_wallets where user_id=$1', [owner])).rows.length, 0);
});

test('battery SQL grader agrees with the app for every published exercise and rejects malformed answers', async t => {
  const db = await createTestDatabase(); t.after(() => db.close());
  const types = new Set<string>();
  for (const lesson of initialUnit.lessons) for (const q of lesson.questions) {
    types.add(q.type);
    assert.equal((await db.query<{ result: boolean }>('select public.battery_grade($1,$2::jsonb) result', [q.id, JSON.stringify(q.correctAnswer)])).rows[0]!.result, true, q.id);
    if (q.type !== 'content_card') {
      const wrong = wrongAnswer(q);
      assert.equal((await db.query<{ result: boolean }>('select public.battery_grade($1,$2::jsonb) result', [q.id, JSON.stringify(wrong)])).rows[0]!.result, evaluateQuestion(q, wrong), q.id);
      await assert.rejects(db.query('select public.battery_grade($1,$2::jsonb)', [q.id, 'null']), /answer_invalid/);
    }
  }
  assert.ok(types.size >= 16);
});
