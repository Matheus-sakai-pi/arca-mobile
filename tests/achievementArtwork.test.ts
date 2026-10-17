import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { achievementDefinitions } from '../src/lib/achievements.ts';

test('every achievement has distinct bundled transparent artwork', async () => {
  const registry = await readFile(new URL('../src/constants/achievementArtwork.ts', import.meta.url), 'utf8');
  const entries = [...registry.matchAll(/^  (\w+): require\('\.\.\/\.\.\/assets\/achievements\/([^']+)'\)/gm)];
  assert.deepEqual(entries.map(entry => entry[1]), achievementDefinitions.map(item => item.id));
  assert.doesNotMatch(registry, /https?:/);
  assert.match(registry, /satisfies Record<AchievementId, ImageSourcePropType>/);
  const hashes = new Set<string>();
  for (const entry of entries) {
    const png = await readFile(new URL(`../assets/achievements/${entry[2]}`, import.meta.url));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.ok(png.readUInt32BE(16) >= 512 && png.readUInt32BE(20) >= 512);
    assert.equal(png[25], 6, 'Achievement art retains RGBA transparency');
    hashes.add(createHash('sha256').update(png).digest('hex'));
  }
  assert.equal(hashes.size, achievementDefinitions.length);
});

test('profile and celebration reuse the same decorative artwork without writing progress', async () => {
  const source = async (path: string) => readFile(new URL('../src/' + path, import.meta.url), 'utf8');
  const profile = await source('components/profile/AchievementsSection.tsx');
  const celebration = await source('components/animation/AchievementCelebration.tsx');
  for (const component of [profile, celebration]) assert.match(component, /<AchievementIcon id=\{item.id\}/);
  assert.match(profile, /unlocked=\{unlocked\}/);
  assert.match(profile, /unlocked \? <Check/);
  assert.match(celebration, /dismissAchievement\(id\)/);
  const icon = await source('components/profile/AchievementIcon.tsx');
  assert.match(icon, /resizeMode="contain"/);
  assert.match(icon, /pointerEvents="none"/);
  assert.match(icon, /width: size, height: size/);
  assert.doesNotMatch(icon, /setItem|completeLesson|unlockAchievements|useEffect/);
});
