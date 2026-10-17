import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

test('original owner-provided blue and gray coin assets remain intact as source references', async () => {
  const Jimp = createRequire(import.meta.url)('jimp-compact') as { read: (data: Buffer) => Promise<{ bitmap: { width: number; height: number; data: Buffer } }> };
  for (const [color, hash] of [
    ['blue', 'a564fbb50beec93779db7879cecdb1b71fa5530f08e1819f38b7f4dcba101f74'],
    ['gray', '06b6a3c351f57a66668168ff7639330cbc8c60db65059e2e5fffcde3d7e46080'],
  ]) {
    const data = await readFile(new URL(`../../assets/ui/trail-coin-${color}.png`, import.meta.url));
    assert.equal(createHash('sha256').update(data).digest('hex'), hash);
    const { bitmap } = await Jimp.read(data);
    assert.equal(bitmap.width, 1024); assert.equal(bitmap.height, 1024);
    assert.equal(bitmap.data[3], 0, 'transparent corner');
    assert.ok(bitmap.data[(512 * bitmap.width + 512) * 4 + 3]! > 200, 'opaque center');
  }
  const registry = await readFile(new URL('../../src/constants/trailAssets.ts', import.meta.url), 'utf8');
  for (const state of ['available', 'current', 'completed']) assert.match(registry, new RegExp(`${state}: require\\('.*trail-coin-blue\\.png'\\)`));
  assert.match(registry, /locked: require\('.*trail-coin-gray\.png'\)/);
  assert.doesNotMatch(registry, /trail-coin-(gold|silver|locked|current)\.png/);
});
