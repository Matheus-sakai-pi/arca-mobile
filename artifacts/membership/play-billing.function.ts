import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT } from 'npm:jose@6';
export const MEMBERSHIP_CONFIG = Object.freeze({
  packageName: 'com.arca.mobile',
  productId: 'arca_vip',
  monthlyPlan: 'mensal',
  yearlyPlan: 'anual',
  monthlyBRL: 19.9,
  yearlyBRL: 99.9,
  xpPercent: 10,
  referralDays: 3,
  verificationHours: 24,
});

const config = MEMBERSHIP_CONFIG;


type RecordValue = Record<string, unknown>;
const isPlayRecord = (v: unknown): v is RecordValue => !!v && typeof v === 'object' && !Array.isArray(v);
export function verifiedPlaySubscription(value: unknown, account: string) {
  if (
    !isPlayRecord(value) ||
    !isPlayRecord(value.externalAccountIdentifiers) ||
    value.externalAccountIdentifiers.obfuscatedExternalAccountId !== account
  )
    throw new Error('purchase_owner_mismatch');
  if (
    !['ACKNOWLEDGEMENT_STATE_PENDING', 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED'].includes(
      String(value.acknowledgementState),
    )
  )
    throw new Error('purchase_acknowledgement_invalid');
  if (!Array.isArray(value.lineItems) || value.lineItems.length !== 1)
    throw new Error('purchase_product_invalid');
  const item: unknown = value.lineItems[0];
  const pending = value.subscriptionState === 'SUBSCRIPTION_STATE_PENDING';
  const cancelledPending = value.subscriptionState === 'SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED';
  if (
    !isPlayRecord(item) ||
    item.productId !== config.productId ||
    !isPlayRecord(item.offerDetails) ||
    !(
      item.offerDetails.basePlanId === config.monthlyPlan ||
      item.offerDetails.basePlanId === config.yearlyPlan
    ) ||
    (!pending &&
      !cancelledPending &&
      (typeof item.expiryTime !== 'string' || !Number.isFinite(Date.parse(item.expiryTime)))) ||
    typeof value.subscriptionState !== 'string'
  )
    throw new Error('purchase_product_invalid');
  const states = [
    'SUBSCRIPTION_STATE_ACTIVE',
    'SUBSCRIPTION_STATE_IN_GRACE_PERIOD',
    'SUBSCRIPTION_STATE_CANCELED',
    'SUBSCRIPTION_STATE_ON_HOLD',
    'SUBSCRIPTION_STATE_PAUSED',
    'SUBSCRIPTION_STATE_EXPIRED',
    'SUBSCRIPTION_STATE_PENDING',
    'SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED',
  ];
  if (!states.includes(value.subscriptionState)) throw new Error('purchase_state_invalid');
  return {
    product: config.productId,
    plan: String(item.offerDetails.basePlanId),
    state: value.subscriptionState,
    expiry: pending || cancelledPending ? '1970-01-01T00:00:00.000Z' : (item.expiryTime as string),
    renew: isPlayRecord(item.autoRenewingPlan) && item.autoRenewingPlan.autoRenewEnabled === true,
    needsAcknowledgement: value.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_PENDING',
    pending,
  };
}

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


const env = (key: string) => { const value = Deno.env.get(key); if (!value) throw new Error('billing_not_configured'); return value; };
const db = () => createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } });
const sha = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), b => b.toString(16).padStart(2, '0')).join('');
const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
let oauth: { token: string; until: number } | null = null;
async function googleAccess() {
  if (oauth && oauth.until > Date.now()) return oauth.token;
  const key = await importPKCS8(env('GOOGLE_PLAY_PRIVATE_KEY').replace(/\\n/g, '\n'), 'RS256');
  const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/androidpublisher' }).setProtectedHeader({ alg: 'RS256' })
    .setIssuer(env('GOOGLE_PLAY_CLIENT_EMAIL')).setAudience('https://oauth2.googleapis.com/token').setIssuedAt().setExpirationTime('5m').sign(key);
  const result = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', signal: AbortSignal.timeout(12000),
    headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }) });
  if (!result.ok) throw new Error('google_unavailable');
  const body = await result.json();
  if (typeof body.access_token !== 'string') throw new Error('google_unavailable');
  oauth = { token: body.access_token, until: Date.now() + 240000 };
  return oauth.token;
}
async function verify(user: string, token: string) {
  const checked = new Date().toISOString(), account = await sha(user), access = await googleAccess();
  const root = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${config.packageName}/purchases`;
  const result = await fetch(`${root}/subscriptionsv2/tokens/${encodeURIComponent(token)}`, {
    headers: { Authorization: `Bearer ${access}` }, signal: AbortSignal.timeout(12000),
  });
  if (!result.ok) throw new Error('purchase_verification_failed');
  const verified = verifiedPlaySubscription(await result.json(), account);
  if (verified.needsAcknowledgement && ['SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD', 'SUBSCRIPTION_STATE_CANCELED'].includes(verified.state)) {
    const ack = await fetch(`${root}/subscriptions/${config.productId}/tokens/${encodeURIComponent(token)}:acknowledge`, {
      method: 'POST', signal: AbortSignal.timeout(12000), headers: { Authorization: `Bearer ${access}`, 'content-type': 'application/json' }, body: '{}',
    });
    if (!ack.ok) throw new Error('purchase_acknowledgement_failed');
  }
  const { error } = await db().rpc('store_play_subscription', { p_user: user, p_token: token, p_account: account, p_product: verified.product,
    p_plan: verified.plan, p_state: verified.state, p_expiry: verified.expiry, p_checked: checked, p_renew: verified.renew });
  if (error) throw new Error('purchase_storage_failed');
  return { pending: verified.pending };
}

Deno.serve(createBillingHandler({
  packageName: config.packageName,
  verify,
  authenticate: async authorization => {
    if (!authorization.startsWith('Bearer ')) return null;
    const { data, error } = await db().auth.getUser(authorization.slice(7));
    return error ? null : data.user?.id ?? null;
  },
  authenticateCron: authorization => authorization === `Bearer ${env('PLAY_BILLING_CRON_SECRET')}`,
  authenticateGoogle: async authorization => {
    try {
      const jwt = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
      const { payload } = await jwtVerify(jwt, googleKeys, { audience: env('GOOGLE_PLAY_RTDN_AUDIENCE'), issuer: ['https://accounts.google.com', 'accounts.google.com'] });
      return payload.email === env('GOOGLE_PLAY_RTDN_EMAIL') && payload.email_verified === true;
    } catch { return false; }
  },
  lookupOwner: async token => {
    const { data, error } = await db().from('play_subscriptions').select('user_id').eq('token_hash', await sha(token)).maybeSingle();
    if (error) throw new Error('purchase_storage_failed');
    return data?.user_id ?? null;
  },
  billingEnabled: async () => {
    const { data, error } = await db().from('membership_config').select('billing_enabled').single();
    if (error) throw new Error('billing_not_configured');
    return data?.billing_enabled === true;
  },
  admit: async user => {
    const { data, error } = await db().rpc('play_verification_admit', { p_user: user });
    if (error) throw new Error('purchase_storage_failed');
    return data === true;
  },
  reconcile: async () => {
      const client = db();
      const { data, error } = await client.from('play_subscriptions').select('user_id,purchase_token')
        .not('user_id', 'is', null).or(`expires_at.gt.${new Date(Date.now() - 60 * 86400000).toISOString()},state.eq.SUBSCRIPTION_STATE_PENDING`)
        .lt('verified_at', new Date(Date.now() - 3600000).toISOString()).order('verified_at').limit(8);
      if (error) throw new Error('purchase_storage_failed');
      let checked = 0, failed = 0;
      for (const row of data ?? []) { try { await verify(row.user_id, row.purchase_token); checked++; } catch { failed++; } }
      return { checked, failed };
  },
}));
