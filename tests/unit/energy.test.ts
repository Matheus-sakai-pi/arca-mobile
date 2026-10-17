import assert from 'node:assert/strict';
import { test } from 'node:test';
// Historical v1 migration/cache regression coverage; current rules are in battery.test.ts.
import { createGuestEnergyStore, decodeEnergy, ENERGY_INTERVAL, energyKey, energyWait, freshEnergy, localEnergyState, parseEnergy, recoverEnergy } from '../../src/lib/legacyEnergy.ts';
import { accountDataKey } from '../../src/lib/accountStorageGuard.ts';

test('energy recovers on elapsed intervals, caps at five, retains partial time and resists backwards clocks', () => {
  const start = 1800000000000;
  const spent = { ...freshEnergy('guest', start), balance: 0, nextRefillAt: start + ENERGY_INTERVAL };
  assert.equal(recoverEnergy(spent, start + ENERGY_INTERVAL - 1).balance, 0);
  const partial = recoverEnergy(spent, start + ENERGY_INTERVAL * 2 + 1234);
  assert.equal(partial.balance, 2); assert.equal(partial.nextRefillAt, start + ENERGY_INTERVAL * 3);
  const full = recoverEnergy(spent, start + ENERGY_INTERVAL * 80);
  assert.equal(full.balance, 5); assert.equal(full.nextRefillAt, null);
  assert.equal(recoverEnergy(partial, start).balance, 2); assert.equal(recoverEnergy(partial, start).observedAt, partial.observedAt);
});

test('guest energy is durable, free/resume-safe, serial, bounded, and cannot charge when storage fails', async () => {
  const values = new Map<string, string>(); let time = 1800000000000, fail = false;
  const storage = { getItem: async (key: string) => values.get(key) ?? null, setItem: async (key: string, value: string) => { if (fail) throw new Error('disk'); values.set(key, value); } };
  const store = createGuestEnergyStore(storage, () => time);
  await store.begin('intro', true); assert.equal((await store.load()).balance, 5);
  await Promise.all([store.begin('four', false), store.begin('four', false), store.begin('four', false)]);
  assert.equal((await store.load()).balance, 4);
  const reopened = createGuestEnergyStore(storage, () => time); await reopened.begin('four', false);
  assert.equal((await reopened.load()).balance, 4);
  fail = true; await assert.rejects(store.begin('five', false), /disk/); fail = false;
  assert.equal((await store.load()).balance, 4);
  for (const id of ['five', 'six', 'seven', 'eight']) await store.begin(id, false);
  assert.equal((await store.begin('nine', false)).allowed, false);
  assert.equal((await store.begin('four', false)).allowed, true);
  assert.equal((await store.begin('review', true)).balance, 0);
  time += ENERGY_INTERVAL; assert.equal((await store.load()).balance, 1);
  await store.begin('nine', false); assert.equal((await store.load()).balance, 0);
});

test('energy contracts reject cross-account and corrupt caches without overwriting them', () => {
  const value = freshEnergy('one', 1800000000000), state = localEnergyState(value);
  assert.deepEqual(decodeEnergy(state, 'one'), state);
  assert.throws(() => decodeEnergy(state, 'two'));
  for (const change of [{ balance: -1 }, { balance: 6 }, { balance: 2.5 }, { nextRefillAt: 'invalid' }, { cost: '1' }, { balance: 0 }]) assert.throws(() => decodeEnergy({ ...state, ...change }, 'one'));
  for (const change of [{ balance: 6 }, { lessons: ['a', 'a'] }, { owner: 'two' }, { balance: 0 }, { observedAt: -1 }]) assert.throws(() => parseEnergy(JSON.stringify({ ...value, ...change }), 'one'));
  assert.equal(accountDataKey(energyKey('one'), 'one'), true);
  assert.equal(accountDataKey(energyKey('two'), 'one'), false);
  assert.equal(energyWait({ ...state, balance: 4, nextRefillAt: new Date(value.observedAt + ENERGY_INTERVAL).toISOString() }, 1000, 1000), '4h 0min');
});
