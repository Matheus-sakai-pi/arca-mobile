import { normalizeUsername, validUsername, usernameHint } from '@/lib/username';
import { requireSupabase, scopedSupabase } from '@/lib/supabase';

export async function assertUsernameAvailable(value: string, owner?: string) {
  if (!validUsername(value)) throw new Error(usernameHint);
  const client = owner ? scopedSupabase(requireSupabase(), owner) : requireSupabase();
  const { data, error } = await client.rpc('learning_username_available', {
    p_username: normalizeUsername(value),
  });
  if (error)
    throw new Error(
      ['PGRST202', '42883'].includes(error.code) ? 'username_setup_required' : 'username_unavailable',
    );
  if (data !== true) throw new Error(data === false ? 'username_taken' : 'username_unavailable');
}
