import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test, type TestContext } from 'node:test';
import { createClient, type Session } from '@supabase/supabase-js';
import { createChunkedStorage } from '../src/lib/chunkedStorage.ts';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}
function session(refresh = 'original'): Session {
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const id = '00000000-0000-4000-8000-000000000001';
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return {
    access_token: [encode({ alg: 'HS256', typ: 'JWT' }), encode({ sub: id, exp: expires, aud: 'authenticated' }), encode('local-test-signature')].join('.'),
    refresh_token: refresh, token_type: 'bearer', expires_in: 3600, expires_at: expires,
    user: { id, aud: 'authenticated', email: 'local@example.invalid', app_metadata: {}, user_metadata: { display_name: 'João'.repeat(800) }, created_at: new Date().toISOString() },
  };
}
async function fixture(t: TestContext, stored = true) {
  const values = new Map<string, string>();
  const storage = createChunkedStorage({
    async getItem(key) { await Promise.resolve(); return values.get(key) ?? null; },
    async setItem(key, value) { await Promise.resolve(); values.set(key, value); },
    async removeItem(key) { await Promise.resolve(); values.delete(key); },
  });
  const key = 'arca-auth-coordination-test';
  const original = session();
  if (stored) await storage.setItem(key, JSON.stringify(original));
  const started = deferred(), release = deferred();
  let refreshes = 0;
  let blockRefresh = false;
  const warnings: string[] = [];
  t.mock.method(console, 'warn', (message: unknown) => warnings.push(String(message)));
  const client = createClient('https://arca-auth.example.invalid', 'local-test-public-key', {
    auth: { storage, storageKey: key, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false, flowType: 'implicit' },
    global: { fetch: async (input, init) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/token')) {
        if (url.searchParams.get('grant_type') === 'refresh_token') {
          refreshes++; started.resolve();
          if (blockRefresh) await release.promise;
        } else assert.equal(url.searchParams.get('grant_type'), 'password');
        return new Response(JSON.stringify(session('rotated')), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.pathname.endsWith('/logout')) {
        assert.equal(init?.method, 'POST');
        return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      throw new Error('Unexpected request in local auth test: ' + url.pathname);
    } },
  });
  t.after(async () => { release.resolve(); await client.auth.dispose(); });
  await client.auth.getSession();
  return { client, storage, key, original, warnings, started, release, get refreshes() { return refreshes; }, block() { blockRefresh = true; } };
}

test('Supabase configuration drops the deprecated SDK lock but preserves persistence and foreground renewal', async () => {
  const source = await readFile(new URL('../src/lib/supabase.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /processLock|\block\s*:/);
  for (const option of ['storage: sessionStorage', 'autoRefreshToken: true', 'persistSession: true', 'detectSessionInUrl: false']) assert.ok(source.includes(option));
  const provider = await readFile(new URL('../src/providers/AuthProvider.tsx', import.meta.url), 'utf8');
  assert.ok(provider.includes('startAutoRefresh()'));
  assert.ok(provider.includes('stopAutoRefresh()'));
});

test('installed lockless SDK restores the existing chunked session without deprecation warnings', async t => {
  const f = await fixture(t);
  const result = await f.client.auth.getSession();
  assert.equal(result.error, null);
  assert.equal(result.data.session?.refresh_token, f.original.refresh_token);
  assert.equal(await f.storage.getItem(f.key), JSON.stringify(f.original));
  assert.equal(f.refreshes, 0);
  assert.ok(!f.warnings.some(message => message.includes('lock') && message.includes('deprecated')));
});

test('concurrent lockless renewals make one refresh request and persist one intact rotated session', async t => {
  const f = await fixture(t);
  f.block();
  const first = f.client.auth.refreshSession();
  await f.started.promise;
  const second = f.client.auth.refreshSession();
  const cached = await f.client.auth.getSession();
  assert.equal(cached.data.session?.refresh_token, 'original');
  f.release.resolve();
  const results = await Promise.all([first, second]);
  assert.equal(f.refreshes, 1);
  for (const result of results) { assert.equal(result.error, null); assert.equal(result.data.session?.refresh_token, 'rotated'); }
  const saved = JSON.parse((await f.storage.getItem(f.key))!);
  assert.equal(saved.refresh_token, 'rotated');
  assert.deepEqual(saved.user.user_metadata, f.original.user.user_metadata);
});

test('logout during lockless refresh cannot restore a signed-out session', async t => {
  const f = await fixture(t);
  f.block();
  const pending = f.client.auth.refreshSession();
  await f.started.promise;
  assert.equal((await f.client.auth.signOut({ scope: 'local' })).error, null);
  f.release.resolve();
  const refreshed = await pending;
  assert.equal(refreshed.data.session, null);
  assert.equal(refreshed.error?.name, 'AuthRefreshDiscardedError');
  assert.equal(await f.storage.getItem(f.key), null);
  assert.equal((await f.client.auth.getSession()).data.session, null);
});

test('lockless password login persists its session in the existing chunked storage format', async t => {
  const f = await fixture(t, false);
  const result = await f.client.auth.signInWithPassword({ email: 'local@example.invalid', password: 'local-test-password' });
  assert.equal(result.error, null);
  assert.equal(result.data.session?.refresh_token, 'rotated');
  assert.equal(JSON.parse((await f.storage.getItem(f.key))!).refresh_token, 'rotated');
  assert.equal((await f.client.auth.getSession()).data.session?.refresh_token, 'rotated');
});
