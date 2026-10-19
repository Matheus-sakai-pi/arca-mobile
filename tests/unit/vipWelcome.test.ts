import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nextVipWelcomeValue, shouldWelcomeVip, vipWelcomeKey } from '../../src/lib/vipWelcome.ts';
import { accountDataKey } from '../../src/lib/accountStorageGuard.ts';

test('welcome only on the change from free to VIP, never for accounts that were already VIP', () => {
  assert.equal(shouldWelcomeVip('false', true), true);
  assert.equal(shouldWelcomeVip(null, true), false);
  assert.equal(shouldWelcomeVip('true', true), false);
  assert.equal(shouldWelcomeVip('false', false), false);
});
test('stored state: free accounts are remembered; the VIP change is saved only when the welcome closes', () => {
  assert.equal(nextVipWelcomeValue(null, false), 'false');
  assert.equal(nextVipWelcomeValue('true', false), 'false');
  assert.equal(nextVipWelcomeValue('false', false), null);
  assert.equal(nextVipWelcomeValue(null, true), 'true');
  assert.equal(nextVipWelcomeValue('false', true), null);
  assert.equal(nextVipWelcomeValue('true', true), null);
});
test('the welcome flag is erased with the account data', () => {
  const owner = '00000000-0000-4000-8000-000000000001';
  assert.equal(accountDataKey(vipWelcomeKey(owner), owner), true);
  assert.equal(accountDataKey(vipWelcomeKey(owner), '00000000-0000-4000-8000-000000000002'), false);
});
