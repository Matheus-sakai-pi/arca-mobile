import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { ENERGY_CONFIG as rules } from '../../src/config/energy.ts';
import { decodeEnergy, energyIntervalText, energyWait, resumeEnergyDraft, type EnergyState } from '../../src/lib/energy.ts';
import { createAttempt, reduceAttempt } from '../../src/lib/lessonEngine.ts';
import { initialUnit } from '../../src/data/lessons.ts';
import { lessonFingerprint } from '../../src/lib/studyStore.ts';

const base = (): EnergyState => ({ version: rules.version, owner: 'one', available: true, enabled: true, balance: rules.capacity, nextRefillAt: null, serverNow: '2026-10-17T12:00:00Z', rules, allowed: true, session: null, receipt: null });
test('one configuration drives app/server rules, 25 points refill in 24 hours and defaults never overflow', async () => {
  const migration = await readFile(new URL('../../supabase/migrations/202610170001_exercise_energy.sql', import.meta.url), 'utf8');
  assert.ok(migration.includes(JSON.stringify(rules)));
  assert.equal(rules.capacity, 25); assert.equal(rules.exerciseCost, 1);
  assert.equal(rules.capacity * rules.refillSeconds, 24 * 3600);
  assert.deepEqual(rules.streakMilestones, [5, 10]);
  assert.equal(rules.streakBonusMin, 5); assert.equal(rules.streakBonusMax, 8);
  assert.equal(rules.perfectBonus, 5); assert.equal(rules.bonusOverflow, false);
  assert.ok(rules.minimumDraftHours >= 24);
});

test('battery responses reject corrupt/foreign balances and honor configured overflow', () => {
  const state = base();
  assert.deepEqual(decodeEnergy(state, 'one'), state);
  assert.throws(() => decodeEnergy(state, 'other'));
  for (const change of [{ version: 1 }, { balance: -1 }, { balance: 26 }, { balance: 1.5 }, { balance: 0 }, { serverNow: 'bad' }, { allowed: 'yes' }, { receipt: { key: 'fake' } }]) assert.throws(() => decodeEnergy({ ...state, ...change }, 'one'));
  assert.equal(decodeEnergy({ ...state, balance: 30, rules: { ...rules, bonusOverflow: true } }, 'one').balance, 30);
});

test('countdown uses confirmed server UTC and monotonic elapsed time, never grants energy locally', () => {
  const state = { ...base(), balance: 0, nextRefillAt: '2026-10-17T12:57:36Z' };
  assert.equal(energyIntervalText(), '57min 36s');
  assert.equal(energyWait(state, 1000, 2000), '57min 35s');
  assert.equal(energyWait(state, 2000, 1000), '57min 36s');
  assert.equal(energyWait(state, 1000, 1000 + rules.refillSeconds * 1000), 'Atualize para conferir a recarga');
  assert.equal(state.balance, 0);
});

test('resume trusts the server receipt and preserves an unsent next-question selection', () => {
  const lesson = initialUnit.lessons[0]!;
  let draft = reduceAttempt(lesson, createAttempt(), { type: 'answer', answer: lesson.questions[0]!.correctAnswer });
  draft = reduceAttempt(lesson, draft, { type: 'verify' });
  let local = reduceAttempt(lesson, draft, { type: 'continue' });
  local = reduceAttempt(lesson, local, { type: 'answer', answer: lesson.questions[1]!.correctAnswer });
  const status = { ...base(), session: { attemptId: 'attempt', draft, nextQuestionId: lesson.questions[1]!.id, nextTurn: 1, remainingNew: 9, streak: 1, legacy: false } };
  const wrapper = { attemptId: 'attempt', fingerprint: lessonFingerprint(lesson), updatedAt: status.serverNow, state: local };
  assert.deepEqual(resumeEnergyDraft(lesson, status, wrapper).state, local);
  assert.deepEqual(resumeEnergyDraft(lesson, status, null).state, draft);
  assert.throws(() => resumeEnergyDraft(lesson, { ...status, session: { ...status.session, draft: { ...draft, index: -1 } } }, null));
});

test('generated battery is a small real transparent bitmap and client cannot mint energy', async () => {
  const Jimp = createRequire(import.meta.url)('jimp-compact') as { read: (data: Buffer) => Promise<{ bitmap: { width: number; height: number; data: Buffer } }> };
  const buffer = await readFile(new URL('../../assets/icons/battery-pink.png', import.meta.url));
  const { bitmap } = await Jimp.read(buffer);
  assert.equal(buffer[25], 6); assert.equal(bitmap.width, 384); assert.equal(bitmap.height, 256);
  let transparent = 0, pink = 0;
  for (let i = 0; i < bitmap.data.length; i += 4) { if (bitmap.data[i + 3]! < 20) transparent++; if (bitmap.data[i]! > 180 && bitmap.data[i + 2]! > 100 && bitmap.data[i + 1]! < 160) pink++; }
  assert.ok(transparent > 1000 && pink > 1000); assert.ok(buffer.length < 200000);
  const provider = await readFile(new URL('../../src/providers/EnergyProvider.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(provider, /recoverEnergy|Math\.random|balance\s*[+:=-]/);
  assert.match(provider, /energyRepository/);
});
