import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { decodeProfileAppearance, defaultAppearance, isPremiumAppearance, profileBackgrounds, profileFrames, visibleProfileAppearance } from '../../src/lib/profileAppearance.ts';

test('appearance decoder isolates accounts, rejects unknown styles and never invents VIP', () => {
  const raw = { owner: 'one', frame: 'gold', background: 'garden', showBadge: true, vip: true };
  assert.deepEqual(decodeProfileAppearance(raw, 'one'), raw);
  for (const bad of [null, { ...raw, owner: 'two' }, { ...raw, frame: 'url(x)' }, { ...raw, background: '../private' }, { ...raw, vip: 'true' }, { ...raw, showBadge: 1 }]) assert.throws(() => decodeProfileAppearance(bad, 'one'));
  assert.equal(isPremiumAppearance(defaultAppearance), false);
  assert.equal(isPremiumAppearance({ ...defaultAppearance, background: 'sky' }), true);
  assert.equal(visibleProfileAppearance(null, true).showBadge, false);
  assert.equal(visibleProfileAppearance({ frame: 'gold', background: 'garden', showBadge: true }, false).frame, 'classic');
});

test('server catalog matches the app and the ready SQL file is the exact migration', async () => {
  const sql = await readFile(new URL('../../supabase/migrations/202610180006_profile_appearance.sql', import.meta.url), 'utf8');
  for (const { key } of [...profileFrames, ...profileBackgrounds]) assert.ok(sql.includes("'" + key + "'"));
  assert.equal(await readFile(new URL('../../artifacts/membership/ativar-personalizacao-vip.sql', import.meta.url), 'utf8'), sql);
});

test('original profile textures are real 512px PNGs with a bounded bundle size', async () => {
  let total = 0;
  for (const key of ['garden', 'sky', 'stars']) {
    const png = await readFile(new URL('../../assets/profile/' + key + '.png', import.meta.url));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(png.readUInt32BE(16), 512); assert.equal(png.readUInt32BE(20), 512);
    assert.ok(png.length > 10000); total += png.length;
  }
  assert.ok(total < 1500000);
});
