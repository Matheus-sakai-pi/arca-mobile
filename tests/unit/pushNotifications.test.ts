import assert from 'node:assert/strict';
import { test } from 'node:test';
import { boundedPushOperation, createPushController, decodePushPreferences, defaultPushPreferences, pushDestination, pushDeviceKey, validPushToken } from '../../src/lib/pushNotifications.ts';
import { createPushDispatcher } from '../../supabase/functions/dispatch-push/handler.ts';

const token = 'ExpoPushToken[abcdefghijklmnopqrstuv]';
test('push registration timeout cannot hold the logout queue forever', async () => {
  assert.equal(await boundedPushOperation(Promise.resolve(5)), 5);
  await assert.rejects(boundedPushOperation(new Promise<never>(() => undefined), 5), /registro de avisos/);
});
function fixture() {
  const values = new Map<string, string>(), prefs = new Map<string, typeof defaultPushPreferences>();
  const calls: string[] = []; let permission = true, registerFails = false, diskFails = false;
  const controller = createPushController({ storage: {
    getItem: async key => values.get(key) ?? null,
    setItem: async (key, value) => { if (diskFails) throw new Error('disk'); values.set(key, value); },
    removeItem: async key => { values.delete(key); },
  }, device: { allowed: async () => permission, authorize: async () => { calls.push('authorize'); return permission; }, token: async () => token, revoke: async () => { calls.push('native-revoke'); } },
  repository: owner => ({ load: async () => prefs.get(owner) ?? { ...defaultPushPreferences }, save: async value => { prefs.set(owner, value); return value; },
    register: async () => { calls.push(`register:${owner}`); if (registerFails) throw new Error('response lost'); }, remove: async () => { calls.push(`remove:${owner}`); } }),
  });
  return { controller, values, prefs, calls, permission: (value: boolean) => { permission = value; }, registerFails: () => { registerFails = true; }, diskFails: () => { diskFails = true; } };
}
test('push permission is opt-in, preferences default off and denial does not change server consent', async () => {
  const f = fixture(); await f.controller.activate('one'); await f.controller.sync('one'); assert.equal(f.calls.length, 0);
  f.permission(false); await assert.rejects(f.controller.save('one', { ...defaultPushPreferences, energy: true }), /Permita/);
  assert.equal(f.prefs.size, 0); assert.deepEqual(f.calls, ['authorize']);
  f.permission(true); await f.controller.save('one', { ...defaultPushPreferences, energy: true });
  assert.deepEqual(JSON.parse(f.values.get(pushDeviceKey)!), { owner: 'one', token, confirmed: true });
  await f.controller.detach(); assert.ok(f.calls.includes('remove:one')); assert.ok(f.calls.includes('native-revoke')); assert.equal(f.values.size, 0);
});
test('push lost registration response remains revocable, disk failure prevents registration and old owners cannot save', async () => {
  const f = fixture(); await f.controller.activate('one'); f.registerFails();
  await assert.rejects(f.controller.save('one', { ...defaultPushPreferences, energy: true }), /response lost/);
  assert.equal(await f.controller.registered('one'), false);
  assert.ok(f.values.has(pushDeviceKey)); await f.controller.activate('two'); assert.ok(f.calls.includes('remove:one'));
  await assert.rejects(f.controller.save('one', defaultPushPreferences), /conta mudou/);
  const disk = fixture(); await disk.controller.activate('one'); disk.diskFails();
  await assert.rejects(disk.controller.save('one', { ...defaultPushPreferences, energy: true }), /disk/);
  assert.ok(!disk.calls.includes('register:one'));
});
test('push stale account operations cannot register or revoke the next account, and a corrupt cache can be invalidated', async () => {
  const f = fixture(); await f.controller.activate('one');
  const save = f.controller.save('one', { ...defaultPushPreferences, energy: true });
  const switched = f.controller.activate('two');
  await assert.rejects(save, /conta mudou/); await switched;
  await f.controller.save('two', { ...defaultPushPreferences, energy: true });
  const count = f.calls.length; await f.controller.detach('one'); assert.equal(f.calls.length, count);
  assert.equal(await f.controller.registered('two'), true);
  f.values.set(pushDeviceKey, '{broken'); await f.controller.detach('two'); assert.equal(f.values.has(pushDeviceKey), false);
});
test('push contracts reject malformed preferences, untrusted destinations and another account notification', () => {
  assert.equal(validPushToken(token), true); assert.equal(validPushToken('https://attacker.test'), false);
  assert.throws(() => decodePushPreferences({ energy: true }), /inválidas/);
  assert.throws(() => decodePushPreferences({ ...defaultPushPreferences, timezone: 'not-a-zone' }), /horário/);
  assert.equal(pushDestination({ kind: 'energy', owner: 'one', url: 'https://attacker.test' }, 'one'), '/learn');
  assert.equal(pushDestination({ kind: 'energy', owner: 'one' }, 'two'), null);
  assert.equal(pushDestination({ kind: 'energy', owner: 'one' }, null), null);
  assert.equal(pushDestination({ kind: 'study-reminder' }, 'guest'), '/learn');
});
test('push dispatcher authenticates, uses fixed provider URLs and checks revocation before sending', async () => {
  const secret = 's'.repeat(48), sent: { url: string; body: unknown }[] = [], finished: unknown[][] = [];
  const job = { id: 'job', user: 'one', token, kind: 'energy' as const };
  const handler = createPushDispatcher({ secret, claim: async () => [job, { ...job, id: 'revoked' }], receipts: async () => [], current: async id => id !== 'revoked',
    finish: async (...args) => { finished.push(args); }, fetcher: async (url, options) => {
      sent.push({ url: String(url), body: JSON.parse(String(options?.body)) }); return Response.json({ data: [{ status: 'ok', id: 'receipt' }] });
    } });
  assert.equal((await handler(new Request('https://test', { method: 'POST' }))).status, 401); assert.equal(sent.length, 0);
  const response = await handler(new Request('https://test', { method: 'POST', headers: { Authorization: `Bearer ${secret}` } }));
  assert.equal(response.status, 200); assert.equal(sent[0]!.url, 'https://exp.host/--/api/v2/push/send');
  const payload = sent[0]!.body as { data: { owner: string; kind: string }; ttl: number }[];
  assert.equal(payload.length, 1); assert.deepEqual(payload[0]!.data, { kind: 'energy', owner: 'one', notificationId: 'job' }); assert.equal(payload[0]!.ttl, 3600);
  assert.deepEqual(finished, [['revoked', 'failed'], ['job', 'ticket', 'receipt']]);
});
test('push network ambiguity does not resend, and provider invalid tokens are revoked after receipt checks', async () => {
  const secret = 's'.repeat(48), finished: unknown[][] = []; let requests = 0;
  const handler = createPushDispatcher({ secret, receipts: async () => [], claim: async () => [{ id: 'job', user: 'one', token, kind: 'energy' }], current: async () => true,
    finish: async (...args) => { finished.push(args); }, fetcher: async () => { requests++; throw new Error('network'); } });
  await handler(new Request('https://test', { method: 'POST', headers: { Authorization: `Bearer ${secret}` } }));
  assert.equal(requests, 1); assert.deepEqual([...finished], [['job', 'unknown']]);
  const receipts = createPushDispatcher({ secret, receipts: async () => [{ id: 'job', ticket: 'receipt' }], claim: async () => [], current: async () => true,
    finish: async (...args) => { finished.push(args); }, fetcher: async () => Response.json({ data: { receipt: { status: 'error', details: { error: 'DeviceNotRegistered' } } } }) });
  await receipts(new Request('https://test', { method: 'POST', headers: { Authorization: `Bearer ${secret}` } }));
  assert.deepEqual(finished.at(-1), ['job', 'failed', undefined, true]);
});
