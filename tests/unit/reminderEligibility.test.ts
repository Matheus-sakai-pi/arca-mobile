import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reminderPromptKey, shouldOfferReminder } from '../../src/lib/reminderPrompt.ts';

test('reminder invitation threshold counts unique lessons, including returning learners', () => {
  for (let completed = 0; completed <= 100; completed++) {
    const ids = Array.from({ length: completed }, (_, index) => `lesson-${index}`);
    assert.equal(shouldOfferReminder([...ids, ...ids], false, false), completed >= 3);
    assert.equal(shouldOfferReminder(ids, true, false), false);
    assert.equal(shouldOfferReminder(ids, false, true), false);
  }
  assert.notEqual(reminderPromptKey('guest'), reminderPromptKey('account'));
});
