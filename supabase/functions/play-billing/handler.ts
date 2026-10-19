export type BillingDependencies = {
  authenticate: (authorization: string) => Promise<string | null>;
  authenticateGoogle: (authorization: string) => Promise<boolean>;
  authenticateCron: (authorization: string) => boolean;
  billingEnabled: () => Promise<boolean>;
  admit: (user: string) => Promise<boolean>;
  verify: (user: string, token: string) => Promise<{ pending: boolean }>;
  lookupOwner: (token: string) => Promise<string | null>;
  reconcile: () => Promise<{ checked: number; failed: number }>;
  packageName: string;
};
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const response = (status: number, body: object) => Response.json(body, { status, headers: cors });
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export function createBillingHandler(deps: BillingDependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') return response(405, { error: 'method_not_allowed' });
    if (Number(request.headers.get('content-length') ?? 0) > 16384) return response(413, { error: 'request_too_large' });
    try {
      const text = await request.text();
      if (text.length > 16384) return response(413, { error: 'request_too_large' });
      let body: unknown;
      try { body = JSON.parse(text); } catch { return response(400, { error: 'request_invalid' }); }
      if (!record(body)) return response(400, { error: 'request_invalid' });
      const authorization = request.headers.get('authorization') ?? '';
      if (body.action === 'reconcile') {
        if (!deps.authenticateCron(authorization)) return response(401, { error: 'unauthorized' });
        const result = await deps.reconcile();
        return response(result.failed ? 503 : 200, result);
      }
      if (body.message) {
        if (!await deps.authenticateGoogle(authorization)) return response(401, { error: 'unauthorized' });
        if (!record(body.message) || typeof body.message.data !== 'string') return response(400, { error: 'request_invalid' });
        const notification: unknown = JSON.parse(atob(body.message.data));
        if (!record(notification) || notification.packageName !== deps.packageName) return response(400, { error: 'package_invalid' });
        if (notification.testNotification) return response(200, { ok: true });
        const event = notification.subscriptionNotification;
        const token = record(event) ? event.purchaseToken : null;
        if (typeof token !== 'string' || token.length < 10 || token.length > 4096) return response(400, { error: 'token_invalid' });
        const owner = await deps.lookupOwner(token);
        // A webhook can refresh a known receipt, but cannot nominate its owner.
        if (owner) await deps.verify(owner, token);
        return response(200, { ok: true });
      }
      const user = await deps.authenticate(authorization);
      if (!user) return response(401, { error: 'auth_required' });
      if (!await deps.billingEnabled()) return response(503, { error: 'billing_not_configured' });
      if (typeof body.token !== 'string' || body.token.length < 10 || body.token.length > 4096) return response(400, { error: 'token_invalid' });
      if (!await deps.admit(user)) return response(429, { error: 'try_again_later' });
      return response(200, await deps.verify(user, body.token));
    } catch {
      return response(503, { error: 'purchase_confirmation_unavailable' });
    }
  };
}
