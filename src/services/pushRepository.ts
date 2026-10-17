import { scopedSupabase, requireSupabase } from '@/lib/supabase';
import { decodePushPreferences, type PushPreferences } from '@/lib/pushNotifications';
function check(error: { code?: string; message: string } | null) {
  if (!error) return;
  if (error.code === 'PGRST202' || error.code === '42883') throw new Error('Os avisos automáticos ainda não estão disponíveis.');
  throw new Error('Não foi possível atualizar os avisos. Confira a conexão e tente novamente.');
}
export function pushRepository(owner: string) {
  const client = scopedSupabase(requireSupabase(), owner);
  return {
    async load() {
      const { data, error } = await client.rpc('learning_push_preferences'); check(error);
      const prefs = decodePushPreferences(data);
      if (prefs.energy || prefs.comeback) { const { error: touchError } = await client.rpc('learning_push_touch'); check(touchError); }
      return prefs;
    },
    async save(value: PushPreferences) { const { data, error } = await client.rpc('learning_push_preferences', { p_energy: value.energy, p_comeback: value.comeback, p_timezone: value.timezone }); check(error); return decodePushPreferences(data); },
    async register(token: string, previous?: string) { const { error } = await client.rpc('learning_push_register', { p_token: token, p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, ...(previous ? { p_previous: previous } : {}) }); check(error); },
    async remove(token: string) { const { error } = await client.rpc('learning_push_unregister', { p_token: token }); check(error); },
  };
}
