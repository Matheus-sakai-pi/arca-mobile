import { achievementDefinitions, type AchievementId } from './achievements.ts';
import { parsePreferences, type Preferences } from './preferencesStore.ts';

export type UserSettings = { achievements: AchievementId[]; preferences: Preferences | null };

const known = new Set<string>(achievementDefinitions.map(item => item.id));

// Lê a resposta do servidor sem confiar nela: ignora conquistas desconhecidas e preferências inválidas.
export function decodeUserSettings(value: unknown): UserSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('settings_invalid');
  const data = value as { achievements?: unknown; preferences?: unknown };
  const achievements = Array.isArray(data.achievements)
    ? [...new Set(data.achievements.filter((id): id is AchievementId => typeof id === 'string' && known.has(id)))]
    : [];
  let preferences: Preferences | null = null;
  if (data.preferences && typeof data.preferences === 'object') {
    try { preferences = parsePreferences(JSON.stringify(data.preferences)); } catch { preferences = null; }
  }
  return { achievements, preferences };
}
