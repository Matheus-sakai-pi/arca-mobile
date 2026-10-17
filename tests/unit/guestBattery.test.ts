import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGuestBatteryIdentity, guestBatteryKey, legacyGuestBatteryKey } from '../../src/lib/guestBattery.ts';

const backend = 'https://real.supabase.co', old = 'a'.repeat(64), fresh = 'b'.repeat(64);
function fixture() {
  const values = new Map<string, string>([[legacyGuestBatteryKey, old], ['arca.study.guest.v1', 'keep-history']]);
  const calls: { p_action: string; p_guest?: string }[] = [];
  let valid = old, network = false;
  const make = () => createGuestBatteryIdentity({ backend, storage: {
    getItem: async key => values.get(key) ?? null, setItem: async (key, value) => { values.set(key, value); },
  }, rpc: async args => {
    calls.push(args);
    if (network) return { data: null, error: { code: '503', message: 'offline' } };
    if (args.p_action === 'register') { valid = fresh; return { data: { guestToken: fresh }, error: null }; }
    return args.p_guest === valid ? { data: {}, error: null } : { data: null, error: { code: 'P0001', message: 'battery_guest_required' } };
  }, check: error => { if (error) throw new Error(error.message); } });
  return { values, calls, make, invalid: () => { valid = 'c'.repeat(64); }, offline: (value: boolean) => { network = value; } };
}

test('backend identity keys are distinct and native-storage safe', () => {
  assert.notEqual(guestBatteryKey(backend), guestBatteryKey('http://127.0.0.1:8092'));
  assert.notEqual(guestBatteryKey('http://localhost:8092'), guestBatteryKey('http://localhost:8093'));
  assert.match(guestBatteryKey(backend), /^[a-zA-Z0-9._-]+$/);
});
test('a valid legacy identity is adopted without registering or resetting its wallet', async () => {
  const f = fixture(), identity = f.make();
  assert.deepEqual(await Promise.all([identity.get(), identity.get()]), [old, old]);
  assert.equal(f.values.get(guestBatteryKey(backend)), old);
  assert.deepEqual(f.calls.map(c => c.p_action), ['status']);
  await f.make().get();
  assert.equal(f.calls.some(c => c.p_action === 'register'), false);
});
test('a rejected test identity is replaced once while local history and legacy data remain intact', async () => {
  const f = fixture(); f.invalid(); const identity = f.make();
  assert.deepEqual(await Promise.all([identity.get(), identity.get()]), [fresh, fresh]);
  assert.equal(f.calls.filter(c => c.p_action === 'register').length, 1);
  assert.equal(f.values.get(legacyGuestBatteryKey), old);
  assert.equal(f.values.get('arca.study.guest.v1'), 'keep-history');
  await identity.invalidate(old); await identity.get();
  assert.equal(f.calls.filter(c => c.p_action === 'register').length, 1);
});
test('network failure never replaces a valid wallet and recovery retries the same identity', async () => {
  const f = fixture(), identity = f.make(); f.offline(true);
  await assert.rejects(identity.get(), /offline/);
  assert.equal(f.calls.some(c => c.p_action === 'register'), false);
  assert.equal(f.values.get(legacyGuestBatteryKey), old);
  f.offline(false); assert.equal(await identity.get(), old);
});
test('an identity rejected during the session is revalidated and recovery is deduplicated', async () => {
  const f = fixture(), identity = f.make(); await identity.get(); f.invalid();
  await Promise.all([identity.invalidate(old), identity.invalidate(old)]);
  assert.deepEqual(await Promise.all([identity.get(), identity.get()]), [fresh, fresh]);
  assert.equal(f.calls.filter(c => c.p_action === 'register').length, 1);
});
