import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import { createPushDispatcher } from './handler.ts';

const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await client.rpc(name, args).abortSignal(AbortSignal.timeout(8000));
  if (error) throw new Error('push_database_unavailable'); return data as T;
}
Deno.serve(createPushDispatcher({
  secret: Deno.env.get('PUSH_DISPATCH_SECRET') ?? '', expoAccessToken: Deno.env.get('EXPO_ACCESS_TOKEN'),
  claim: () => rpc('push_claim', { p_limit: 25 }), receipts: () => rpc('push_receipts'),
  current: id => rpc('push_job_current', { p_id: id }),
  finish: (id, status, ticket, invalid) => rpc('push_finish', { p_id: id, p_status: status, p_ticket: ticket ?? null, p_invalid: invalid ?? false }),
}));
