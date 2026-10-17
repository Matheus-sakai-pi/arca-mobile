import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { sessionStorage } from './sessionStorage';
import type { Database } from '@/types/backend';
import { accountAccessToken } from './accountToken';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
function hasConfiguration() {
  if (!url || !key) return false;
  try { const parsed = new URL(url); return ['https:', 'http:'].includes(parsed.protocol) && !!parsed.hostname; }
  catch { return false; }
}
export const isSupabaseConfigured = hasConfiguration();

async function boundedFetch(input: RequestInfo | URL, init?: RequestInit) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (init?.signal?.aborted) controller.abort();
  init?.signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 15000);
  try { return await fetch(input, { ...init, signal: controller.signal }); }
  finally { clearTimeout(timer); init?.signal?.removeEventListener('abort', abort); }
}
export const supabase = isSupabaseConfigured ? createClient<Database>(url!, key!, {
  auth: { storage: sessionStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false, flowType: 'implicit' },
  global: { fetch: boundedFetch },
}) : null;

export const anonymousSupabase = isSupabaseConfigured ? createClient<Database>(url!, key!, {
  accessToken: async () => null,
  global: { fetch: boundedFetch },
}) : null;

export function requireSupabase() {
  if (!supabase) throw new Error('auth_not_configured');
  return supabase;
}
export function scopedSupabase(authClient:SupabaseClient<Database>,userId:string) {
  if (!url || !key) throw new Error('auth_not_configured');
  return createClient<Database>(url,key,{
    accessToken:accountAccessToken(userId,()=>authClient.auth.getSession()),
    global:{fetch:boundedFetch},
  });
}
