import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('button faces size to their content rather than expanding in native scroll layouts', async () => {
  const source = await readFile(new URL('../../src/components/common/Button.tsx', import.meta.url), 'utf8');
  const face = source.match(/face:\s*\{([^}]+)\}/)?.[1];
  assert.ok(face);
  assert.doesNotMatch(face, /\bflex\s*:|\bflexGrow\s*:/);
  assert.match(face, /minHeight:\s*layout.buttonHeight - 4/);
  assert.match(source, /translateY:\s*4/);
});

test('animated values use normal text with fixed edge constraints on both native and web', async () => {
  const source = await readFile(new URL('../../src/components/animation/AnimatedNumber.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /TextInput|NumberInput|useAnimatedProps|Platform\.OS/);
  assert.match(source, /<AppText testID="animated-number-value"/);
  assert.match(source, /if\(next !== previous\) scheduleOnRN\(setDisplayedValue,next\)/);
  const overlay = source.match(/value:\s*\{([^}]+)\}/)?.[1];
  assert.ok(overlay);
  for (const edge of ['top', 'bottom', 'left', 'right']) assert.match(overlay, new RegExp(`${edge}:0`));
  assert.doesNotMatch(overlay, /width:|height:/);
  assert.match(source, /accessibilityLabel=\{final\}/);
});
