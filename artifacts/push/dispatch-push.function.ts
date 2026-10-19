import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
type Job = { id: string; user: string; token: string; kind: 'energy' | 'comeback' };
type Receipt = { id: string; ticket: string };
type Status = 'ticket' | 'accepted' | 'failed' | 'unknown';
type Dependencies = {
  secret: string; expoAccessToken?: string; fetcher?: typeof fetch;
  claim: () => Promise<Job[]>; receipts: () => Promise<Receipt[]>; current: (id: string) => Promise<boolean>;
  finish: (id: string, status: Status, ticket?: string, invalid?: boolean) => Promise<void>;
};
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
function equalSecret(left: string, right: string) {
  const a = new TextEncoder().encode(left), b = new TextEncoder().encode(right); let different = a.length ^ b.length;
  for (let index = 0; index < Math.max(a.length, b.length); index++) different |= (a[index] ?? 0) ^ (b[index] ?? 0);
  return different === 0;
}
export function createPushDispatcher(deps: Dependencies) {
  const fetcher = deps.fetcher ?? fetch;
  async function api(endpoint: 'send' | 'getReceipts', body: unknown): Promise<unknown> {
    const response = await fetcher(`https://exp.host/--/api/v2/push/${endpoint}`, { method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(deps.expoAccessToken ? { Authorization: `Bearer ${deps.expoAccessToken}` } : {}) },
      body: JSON.stringify(body), signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error('push_provider_unavailable'); return response.json();
  }
  return async (request: Request) => {
    const json = (status: number, value: object) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
    if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });
    if (deps.secret.length < 32 || !equalSecret(request.headers.get('Authorization') ?? '', `Bearer ${deps.secret}`)) return json(401, { error: 'unauthorized' });
    try {
      const waiting = await deps.receipts();
      if (waiting.length) {
        try {
          const response = await api('getReceipts', { ids: waiting.map(item => item.ticket) });
          const data = object(response) && object(response.data) ? response.data : {};
          await Promise.all(waiting.map(async item => {
            const receipt = data[item.ticket];
            if (!object(receipt)) { await deps.finish(item.id, 'ticket'); return; }
            const invalid = object(receipt.details) && receipt.details.error === 'DeviceNotRegistered';
            await deps.finish(item.id, receipt.status === 'ok' ? 'accepted' : 'failed', undefined, invalid);
          }));
        } catch { /* Retry receipt reads on the next run, never resend their messages. */ }
      }
      const claimed = await deps.claim();
      const jobs: Job[] = [];
      for (const job of claimed) {
        if (await deps.current(job.id)) jobs.push(job); else await deps.finish(job.id, 'failed');
      }
      if (!jobs.length) return json(200, { submitted: 0 });
      const messages = jobs.map(job => ({ to: job.token, title: job.kind === 'energy' ? 'Sua energia voltou' : 'Sua jornada continua',
        body: job.kind === 'energy' ? 'Você já tem energia para continuar sua jornada no Arca.' : 'Que tal reservar um momento para uma nova lição?',
        data: { kind: job.kind, owner: job.user, notificationId: job.id }, channelId: 'arca-updates', priority: 'normal', ttl: 3600 }));
      let response: unknown;
      try { response = await api('send', messages); }
      catch { await Promise.all(jobs.map(job => deps.finish(job.id, 'unknown'))); return json(200, { submitted: jobs.length, outcome: 'unknown' }); }
      const data = object(response) && Array.isArray(response.data) ? response.data : [];
      await Promise.all(jobs.map(async (job, index) => {
        const ticket: unknown = data[index];
        if (!object(ticket)) { await deps.finish(job.id, 'unknown'); return; }
        const invalid = object(ticket.details) && ticket.details.error === 'DeviceNotRegistered';
        if (ticket.status === 'ok' && typeof ticket.id === 'string') await deps.finish(job.id, 'ticket', ticket.id);
        else await deps.finish(job.id, 'failed', undefined, invalid);
      }));
      return json(200, { submitted: jobs.length });
    } catch { return json(503, { error: 'push_dispatch_unavailable' }); }
  };
}


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
