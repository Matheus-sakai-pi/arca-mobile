import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { colors } from '../../src/constants/colors.ts';
import { typography, fonts } from '../../src/constants/typography.ts';
import { resultMotion } from '../../src/constants/motion.ts';

function luminance(hex: string) {
  const channels = hex.slice(1).match(/../g)!.map(value => {
    const channel = parseInt(value, 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}

test('reading, action and feedback colors meet normal-text AA contrast', () => {
  for (const [ink, surface] of [
    [colors.text, colors.background], [colors.muted, colors.background],
    [colors.muted, colors.surface], [colors.surface, colors.primary],
    [colors.primaryDark, colors.primarySoft], [colors.success, colors.successSoft],
    [colors.error, colors.errorSoft], [colors.goldInk, colors.background],
  ]) {
    const a = luminance(ink!), b = luminance(surface!);
    assert.ok((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 4.5, `${ink} on ${surface}`);
  }
});

test('reading weight is quieter than commands and reward stages finish before the optional invitation', () => {
  assert.equal(typography.body.fontFamily, fonts.regular);
  assert.equal(typography.small.fontFamily, fonts.regular);
  assert.equal(typography.button.fontFamily, fonts.bold);
  assert.ok(typography.button.fontSize < typography.h2.fontSize);
  assert.ok(resultMotion.reward < resultMotion.stats);
  assert.ok(resultMotion.stats < resultMotion.progress);
  assert.ok(resultMotion.progress + resultMotion.duration < resultMotion.invitation);
});

test('new mascot poses are distinct locally bundled RGBA images and never use the reference app assets', async () => {
  const files = ['thinking-v2', 'encouraging-v2', 'correct-v2'];
  const buffers = await Promise.all(files.map(async name => {
    const png = await readFile(new URL(`../../assets/mascot/${name}.png`, import.meta.url));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(png[25], 6, 'Transparency must survive bundling');
    assert.ok(png.readUInt32BE(16) >= 512);
    return png;
  }));
  for (let i = 0; i < buffers.length; i++) {
    for (let j = i + 1; j < buffers.length; j++) assert.ok(!buffers[i]!.equals(buffers[j]!));
  }
  const component = await readFile(new URL('../../src/components/mascot/Mascot.tsx', import.meta.url), 'utf8');
  for (const name of files) assert.ok(component.includes(`${name}.png`));
  assert.doesNotMatch(component, /manna_design|lottie\/sheep/);
});
