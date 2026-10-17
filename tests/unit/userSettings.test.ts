import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodeUserSettings } from '../../src/lib/userSettings.ts';
import { createAchievementStore } from '../../src/lib/achievements.ts';

test('decoder keeps only known achievements and valid preferences', () => {
  assert.deepEqual(decodeUserSettings({ achievements: ['first_step', 'nope', 'first_step', 3], preferences: null }), { achievements: ['first_step'], preferences: null });
  const preferences = { soundEnabled: false, hapticsEnabled: true, reduceMotion: false, dailyGoal: 30 };
  assert.deepEqual(decodeUserSettings({ achievements: [], preferences }).preferences, preferences);
  assert.equal(decodeUserSettings({ achievements: [], preferences: { ...preferences, dailyGoal: 15 } }).preferences, null);
  assert.throws(() => decodeUserSettings(null));
});

test('achievements from another device are merged without a new celebration', async () => {
  const data = new Map<string, string>();
  const store = createAchievementStore({ getItem: async key => data.get(key) ?? null, setItem: async (key, value) => { data.set(key, value); } }, 'conta');
  await store.load();
  const merged = await store.merge(['perfect_lesson', 'scholar']);
  assert.deepEqual(merged.unlocked, ['perfect_lesson', 'scholar']);
  assert.deepEqual(merged.pending, []);
  assert.equal((await store.merge(['scholar'])).unlocked.length, 2);
});
