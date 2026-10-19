import assert from 'node:assert/strict';
import { test } from 'node:test';
import { referralCode, referralMessage, installReferral, formatMembershipPrice } from '../../src/lib/membership.ts';
import { MEMBERSHIP_CONFIG as config } from '../../src/config/membership.ts';
import { verifiedPlaySubscription } from '../../src/lib/playSubscription.ts';
import { deliverPurchase } from '../../src/lib/billingDelivery.ts';
import { createBillingHandler, type BillingDependencies } from '../../supabase/functions/play-billing/handler.ts';

test('VIP reference prices use Brazilian decimals, two cents digits and consistent annual savings', () => {
  assert.equal(config.monthlyBRL, 19.9);
  assert.equal(config.yearlyBRL, 99.9);
  assert.equal(formatMembershipPrice(config.monthlyBRL), 'R$ 19,90');
  assert.equal(formatMembershipPrice(config.yearlyBRL), 'R$ 99,90');
  assert.equal(formatMembershipPrice(config.yearlyBRL / 12), 'R$ 8,33');
  assert.equal(Math.floor((1 - config.yearlyBRL / (config.monthlyBRL * 12)) * 100), 58);
});
test('referral link carries the install code and cannot inject URLs', () => {
  const code = '0123456789ABCDEF';
  assert.equal(installReferral(`arca_invite=${code}`), code);
  assert.equal(referralCode('javascript:foo'), '');
  assert.throws(() => referralMessage('bad'));
  assert.match(referralMessage(code), /referrer=arca_invite%3D0123456789ABCDEF/);
  assert.match(referralMessage(code), /nós dois ganhamos 3 dias de bateria infinita/);
});
test('Google response must match account, product, plan and a recognized state', () => {
  const value = { externalAccountIdentifiers: { obfuscatedExternalAccountId: 'owner' }, subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE', acknowledgementState: 'ACKNOWLEDGEMENT_STATE_PENDING', lineItems: [{ productId: 'arca_vip', offerDetails: { basePlanId: 'anual' }, expiryTime: '2027-01-01T00:00:00Z' }] };
  assert.equal(verifiedPlaySubscription(value, 'owner').needsAcknowledgement, true);
  assert.throws(() => verifiedPlaySubscription(value, 'thief'), /owner_mismatch/);
  assert.throws(() => verifiedPlaySubscription({ ...value, subscriptionState: 'fake' }, 'owner'), /state_invalid/);
  assert.throws(() => verifiedPlaySubscription({ ...value, lineItems: [{ ...value.lineItems[0], productId: 'other' }] }, 'owner'), /product_invalid/);
  assert.equal(verifiedPlaySubscription({ ...value, subscriptionState: 'SUBSCRIPTION_STATE_PENDING' }, 'owner').pending, true);
  assert.equal(verifiedPlaySubscription({ ...value, subscriptionState: 'SUBSCRIPTION_STATE_PENDING', lineItems: [{ productId: 'arca_vip', offerDetails: { basePlanId: 'anual' } }] }, 'owner').pending, true);
});

test('purchase delivery deduplicates simultaneous callbacks, never finishes pending/unverified receipts, and retries failures', async () => {
  const purchase = { purchaseToken: 'pending-purchase' };
  let verifies = 0, finishes = 0;
  const finish = async () => { finishes++; };
  const verify = async () => { verifies++; return true; };
  await Promise.all([deliverPurchase('owner', purchase, verify, finish), deliverPurchase('owner', purchase, verify, finish)]);
  assert.equal(verifies, 1); assert.equal(finishes, 1);
  assert.equal(await deliverPurchase('owner', purchase, async () => false, finish), false);
  assert.equal(finishes, 1);
  await assert.rejects(deliverPurchase('owner', purchase, async () => { throw new Error('network'); }, finish), /network/);
  assert.equal(finishes, 1);
  assert.equal(await deliverPurchase('owner', purchase, verify, finish), true);
  assert.equal(finishes, 2);
});

function fixture() {
  const calls: string[] = [];
  const deps: BillingDependencies = {
    packageName: 'com.arca.mobile', authenticate: async auth => auth === 'Bearer user' ? 'real-owner' : null,
    authenticateGoogle: async auth => auth === 'Bearer google', authenticateCron: auth => auth === 'Bearer cron',
    billingEnabled: async () => true, admit: async () => true,
    verify: async (user, token) => { calls.push(`${user}:${token}`); return { pending: false }; },
    lookupOwner: async () => 'stored-owner', reconcile: async () => ({ checked: 1, failed: 0 }),
  };
  const request = (body: object, authorization = 'Bearer user') => new Request('https://example.test/functions/v1/play-billing', { method: 'POST', headers: { authorization }, body: JSON.stringify(body) });
  return { deps, calls, request };
}
test('billing handler authenticates purchases, ignores nominated owners/VIP flags and fails closed before configuration', async () => {
  const { deps, calls, request } = fixture(), handler = createBillingHandler(deps);
  assert.equal((await handler(request({ token: 'test-token-123', user: 'victim', vip: true, expires: '2099-01-01' }))).status, 200);
  assert.deepEqual(calls, ['real-owner:test-token-123']);
  assert.equal((await handler(request({ token: 'test-token-123' }, 'Bearer stranger'))).status, 401);
  deps.billingEnabled = async () => false;
  assert.equal((await handler(request({ token: 'test-token-123' }))).status, 503);
  assert.equal(calls.length, 1);
  deps.billingEnabled = async () => true; deps.admit = async () => false;
  assert.equal((await handler(request({ token: 'test-token-123' }))).status, 429);
});
test('RTDN requires Google authentication, refreshes only stored owners and never trusts the notification state', async () => {
  const { deps, calls, request } = fixture(), handler = createBillingHandler(deps);
  const notification = { message: { data: btoa(JSON.stringify({ packageName: 'com.arca.mobile', subscriptionNotification: { purchaseToken: 'test-token-123', notificationType: 2 }, owner: 'victim', vip: true })) } };
  assert.equal((await handler(request(notification))).status, 401);
  assert.equal(calls.length, 0);
  assert.equal((await handler(request(notification, 'Bearer google'))).status, 200);
  assert.deepEqual(calls, ['stored-owner:test-token-123']);
  deps.lookupOwner = async () => null;
  await handler(request(notification, 'Bearer google')); assert.equal(calls.length, 1);
});
test('billing scheduler is private and provider failures never leak credentials or return success', async () => {
  const { deps, request } = fixture(), handler = createBillingHandler(deps);
  assert.equal((await handler(request({ action: 'reconcile' }))).status, 401);
  assert.equal((await handler(request({ action: 'reconcile' }, 'Bearer cron'))).status, 200);
  deps.reconcile = async () => ({ checked: 0, failed: 1 });
  assert.equal((await handler(request({ action: 'reconcile' }, 'Bearer cron'))).status, 503);
  deps.verify = async () => { throw new Error('PRIVATE-KEY-SECRET purchase-token'); };
  const failed = await handler(request({ token: 'test-token-123' }));
  assert.equal(failed.status, 503); assert.doesNotMatch(await failed.text(), /PRIVATE|purchase-token/);
  assert.equal((await handler(new Request('https://example.test', { method: 'OPTIONS' }))).status, 200);
  assert.equal((await handler(new Request('https://example.test'))).status, 405);
});
