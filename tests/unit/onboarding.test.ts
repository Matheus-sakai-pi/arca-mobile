import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { initialOnboarding, onboardingQuestion, onboardingSteps, reduceOnboarding } from '../../src/lib/onboarding.ts';
import { evaluateQuestion } from '../../src/lib/questionEngine.ts';

test('onboarding requires a valid demonstration answer but never requires a correct one', () => {
  const practice = reduceOnboarding(initialOnboarding, { type: 'next' });
  assert.equal(practice.step, 'practice');
  assert.equal(reduceOnboarding(practice, { type: 'next' }), practice);
  assert.equal(reduceOnboarding(practice, { type: 'verify' }), practice);
  assert.equal(reduceOnboarding(practice, { type: 'answer', answer: 'unknown' }), practice);
  const answered = reduceOnboarding(practice, { type: 'answer', answer: 'genesis' });
  const checked = reduceOnboarding(answered, { type: 'verify' });
  assert.equal(evaluateQuestion(onboardingQuestion, checked.answer!), false);
  assert.equal(checked.verified, true);
  assert.equal(reduceOnboarding(checked, { type: 'next' }).step, 'energy');
  assert.equal(reduceOnboarding(checked, { type: 'answer', answer: 'mateus' }), checked);
  assert.deepEqual(initialOnboarding, { step: 'welcome', answer: null, verified: false });
});

test('onboarding back, retry, skip and terminal navigation stay bounded', () => {
  assert.equal(new Set(onboardingSteps).size, 4);
  assert.equal(reduceOnboarding(initialOnboarding, { type: 'back' }).step, 'welcome');
  let state = reduceOnboarding(initialOnboarding, { type: 'next' });
  state = reduceOnboarding(state, { type: 'answer', answer: onboardingQuestion.correctAnswer });
  state = reduceOnboarding(state, { type: 'verify' });
  assert.equal(evaluateQuestion(onboardingQuestion, state.answer!), true);
  const energy = reduceOnboarding(state, { type: 'next' });
  assert.deepEqual(reduceOnboarding(energy, { type: 'back' }), state);
  assert.deepEqual(reduceOnboarding(state, { type: 'retry' }), { step: 'practice', answer: null, verified: false });
  for (const step of onboardingSteps) {
    const skipped = reduceOnboarding({ ...initialOnboarding, step }, { type: 'skip' });
    assert.equal(skipped.step, 'ready');
    assert.equal(reduceOnboarding(skipped, { type: 'next' }).step, 'ready');
  }
});

test('demo stays outside real lesson attempts, energy, rewards and notification prompts', async () => {
  for (const file of ['src/lib/onboarding.ts', 'src/app/onboarding/index.tsx']) {
    const source = await readFile(new URL(`../../${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /finishLesson|startLesson|useLearning|useEnergy|saveDraft|recordStudy|requestPermissions|scheduleNotification|supabase\.rpc/);
  }
  const screen = await readFile(new URL('../../src/app/onboarding/index.tsx', import.meta.url), 'utf8');
  assert.match(screen, /QuestionRenderer/);
  assert.match(screen, /ENERGY_MAX/);
  assert.match(screen, /ENERGY_CONFIG/);
  assert.match(screen, /if \(locked.current\) return/);
  assert.doesNotMatch(screen, /assets\/visuals\/.*jpg|ChapterScene/);
});
