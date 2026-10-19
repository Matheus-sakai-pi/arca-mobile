import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { achievementDefinitions } from '../src/lib/achievements.ts';

test('every achievement has its own flat medal (color, icon and number)', async () => {
  const source = await readFile(new URL('../src/components/profile/AchievementIcon.tsx', import.meta.url), 'utf8');
  const entries = [...source.matchAll(/^  (\w+): \{ tone: '([^']+)', ring: '([^']+)', icon: (\w+)(?:, label: '([^']+)')? \},$/gm)];
  assert.deepEqual(entries.map(entry => entry[1]).sort(), achievementDefinitions.map(item => item.id).sort());
  const looks = new Set(entries.map(entry => `${entry[3]}|${entry[4]}|${entry[5] ?? ''}`));
  assert.equal(looks.size, achievementDefinitions.length, 'duas conquistas não podem ter a mesma medalha');
  assert.match(source, /satisfies|Record<AchievementId/);
  assert.doesNotMatch(source, /require\(|https?:/);
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
  // Estilo plano: medalha em SVG com ícone plano, cinza quando bloqueada.
  assert.match(icon, /<Svg /);
  assert.match(icon, /unlocked \? medal.ring : '#C3CBD8'/);
  assert.match(icon, /pointerEvents="none"/);
  assert.match(icon, /width: size, height: size/);
  assert.doesNotMatch(icon, /setItem|completeLesson|unlockAchievements|useEffect/);
});
