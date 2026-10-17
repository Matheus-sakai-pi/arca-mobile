import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('scrolling scenery fills both native edges instead of using a padded percentage width', async () => {
  const source = await readFile(new URL('../../src/components/common/ScrollingIllustration.tsx', import.meta.url), 'utf8');
  const scene = source.match(/scene:\s*\{([^}]+)\}/)?.[1];
  assert.ok(scene);
  assert.match(scene, /position:\s*'absolute'/);
  assert.match(scene, /left:\s*0/);
  assert.match(scene, /right:\s*0/);
  assert.doesNotMatch(scene, /\bwidth\s*:/);
  assert.match(scene, /aspectRatio:\s*2\s*\/\s*3/);
  for (const tab of ['home', 'profile']) {
    const screen = await readFile(new URL(`../../src/app/(tabs)/${tab}.tsx`, import.meta.url), 'utf8');
    assert.match(screen, /scene="ark" sceneScrolls/);
  }
});
