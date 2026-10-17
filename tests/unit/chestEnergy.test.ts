import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { CHEST_ENERGY_CONFIG } from '../../src/config/energy.ts';
import { decodeEnergyChest } from '../../src/lib/energy.ts';

const chest = () => ({ unitId: 'one', completed: 5, total: 10, target: 5, eligible: true, claimed: false, min: 5, max: 7, reward: null });
test('chest reward limits are generated from the shared energy configuration', async () => {
  assert.deepEqual(CHEST_ENERGY_CONFIG, { min: 5, max: 7, completedFraction: 0.5 });
  assert.ok((await readFile(new URL('../../supabase/migrations/202610170003_unit_chest_energy.sql', import.meta.url), 'utf8')).includes(JSON.stringify(CHEST_ENERGY_CONFIG)));
});
test('chest contracts reject inconsistent progress, forged receipts and invalid rewards', () => {
  const base = chest(); assert.deepEqual(decodeEnergyChest(base), base);
  const rewarded = { ...base, claimed: true, reward: { rolled: 7, amount: 2, claimedAt: '2026-10-17T12:00:00Z' } };
  assert.deepEqual(decodeEnergyChest(rewarded), rewarded);
  for (const change of [{ total: 0 }, { completed: -1 }, { completed: 11 }, { target: 11 }, { eligible: false }, { claimed: true }, { min: 8 }, { max: 4 }, { reward: rewarded.reward }]) assert.throws(() => decodeEnergyChest({ ...base, ...change }));
  for (const change of [{ rolled: 8 }, { rolled: 4 }, { amount: 8 }, { amount: -1 }, { claimedAt: 'bad' }]) assert.throws(() => decodeEnergyChest({ ...rewarded, reward: { ...rewarded.reward, ...change } }));
});
