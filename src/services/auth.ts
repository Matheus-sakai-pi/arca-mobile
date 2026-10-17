import * as Linking from 'expo-linking';
import { requireSupabase } from '@/lib/supabase';
import { parseAuthCallback } from '@/lib/authCallback';
import { normalizeUsername } from '@/lib/username';
import { assertUsernameAvailable } from './username';
import { detachDevicePush, restoreDevicePush } from './pushNotifications';

export function authRedirectUrl() {
  return process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL?.trim() || Linking.createURL('/auth/callback');
}
export async function signIn(email: string, password: string) {
  const { data, error } = await requireSupabase().auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) throw error;
  return data;
}
export async function signUp(name: string, email: string, password: string) {
  const username=normalizeUsername(name);
  await assertUsernameAvailable(username);
  const { data, error } = await requireSupabase().auth.signUp({
    email: email.trim().toLowerCase(), password,
    options: { data: { username, display_name: `@${username}` }, emailRedirectTo: authRedirectUrl() },
  });
  if (error) {
    // Auth can hide the trigger's unique-name rejection behind a generic database error.
    if (error.status === 500 || error.code === 'unexpected_failure') await assertUsernameAvailable(username);
    throw error;
  }
  return data;
}
export async function requestPasswordReset(email: string) {
  const { error } = await requireSupabase().auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: authRedirectUrl() });
  if (error) throw error;
}
export async function updatePassword(password: string) {
  const { error } = await requireSupabase().auth.updateUser({ password });
  if (error) throw error;
}
export async function signOut() {
  const client = requireSupabase();
  const { data } = await client.auth.getSession();
  await detachDevicePush();
  const { error } = await client.auth.signOut({ scope: 'local' });
  if (error) { if (data.session) void restoreDevicePush(data.session.user.id).catch(() => undefined); throw error; }
}
export async function consumeAuthCallback(url: string) {
  const callback = parseAuthCallback(url);
  const { data, error } = await requireSupabase().auth.setSession({ access_token: callback.accessToken, refresh_token: callback.refreshToken });
  if (error) throw error;
  if (!data.session) throw new Error('auth_link_invalid');
  return { session: data.session, recovery: callback.recovery };
}
