import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT } from 'npm:jose@6';
import { MEMBERSHIP_CONFIG as config } from '../../../src/config/membership.ts';
import { verifiedPlaySubscription } from '../../../src/lib/playSubscription.ts';
import { createBillingHandler } from './handler.ts';

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
