export type Preferences = { soundEnabled: boolean; hapticsEnabled: boolean; reduceMotion: boolean; dailyGoal: number };
export const defaultPreferences: Preferences = { soundEnabled: true, hapticsEnabled: true, reduceMotion: false, dailyGoal: 10 };
export const preferencesKey = (scope: string) => `arca.preferences.${scope}.v1`;
export function parsePreferences(raw: string | null): Preferences {
  if (!raw) return { ...defaultPreferences };
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('preferences_invalid');
  const p = value as Partial<Preferences>;
  if (typeof p.soundEnabled !== 'boolean' || typeof p.hapticsEnabled !== 'boolean' || typeof p.reduceMotion !== 'boolean'
    || ![10,20,30].includes(p.dailyGoal ?? 0)) throw new Error('preferences_invalid');
  return { soundEnabled: p.soundEnabled, hapticsEnabled: p.hapticsEnabled, reduceMotion: p.reduceMotion, dailyGoal: p.dailyGoal! };
}
