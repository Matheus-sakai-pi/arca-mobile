import { isSupabaseConfigured, requireSupabase, scopedSupabase } from '@/lib/supabase';
import { decodeUserSettings, type UserSettings } from '@/lib/userSettings';
import type { AchievementId } from '@/lib/achievements';
import type { Preferences } from '@/lib/preferencesStore';
import type { Json } from '@/types/backend';

// Sincroniza conquistas e preferências da conta. Sem argumentos, apenas lê o que está salvo.
export async function syncUserSettings(
  owner: string,
  values: { achievements?: readonly AchievementId[]; preferences?: Preferences } = {},
): Promise<UserSettings | null> {
  if (!isSupabaseConfigured || owner === 'guest') return null;
  const client = scopedSupabase(requireSupabase(), owner);
  const { data, error } = await client.rpc('learning_user_settings', {
    p_achievements: values.achievements ? [...values.achievements] : null,
    p_preferences: values.preferences ? (values.preferences as unknown as Json) : null,
  });
  if (error) throw new Error(error.message);
  return decodeUserSettings(data);
}
