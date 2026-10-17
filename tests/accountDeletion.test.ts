import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { createDeletionHandler } from '../supabase/functions/delete-account/handler.ts';
import { createAccountStorage } from '../src/lib/accountStorageGuard.ts';
import { privacyContact, privacySections, deletionRequestUrl } from '../src/constants/privacy.ts';

const request = (body: unknown = { password: 'test-password' }, token = 'token-a') => new Request('https://example.test/delete-account', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(body) });
test('deletion authenticates the JWT and password; body can never nominate a target account', async () => {
  const removed: string[] = []; let identity: { id: string; email: string } | null = { id: 'a', email: 'a@example.test' };
  let passwordId: string | null = 'a'; let limited = false;
  const handler = createDeletionHandler({ authenticate: async token => token === 'token-a' ? identity : null, verifyPassword: async email => { assert.equal(email, 'a@example.test'); return { id: passwordId, limited }; }, deleteUser: async id => { removed.push(id); return true; } });
  for (const input of [null, [], {}, { password: '' }, { password: 'x'.repeat(129) }, { password: 'test', userId: 'b' }, { password: 'test', email: 'b@example.test' }]) assert.equal((await handler(request(input))).status, 400);
  assert.equal((await handler(request({ password: 'x' }, 'invalid-token'))).status, 401);
  identity = null; assert.equal((await handler(request())).status, 401);
  identity = { id: 'a', email: 'a@example.test' }; passwordId = 'b'; assert.equal((await handler(request())).status, 403);
  passwordId = null; assert.equal((await handler(request())).status, 403);
  limited = true; assert.equal((await handler(request())).status, 429);
  assert.deepEqual(removed, []);
  limited = false; passwordId = 'a'; const success = await handler(request());
  assert.deepEqual(await success.json(), { deleted: true, userId: 'a' }); assert.deepEqual(removed, ['a']);
  assert.equal(success.headers.get('cache-control'), 'no-store');
});
test('handler returns CORS preflight, rejects invalid transports and never exposes server errors', async () => {
  const handler = createDeletionHandler({ authenticate: async () => { throw new Error('private-secret'); }, verifyPassword: async () => ({ id: null, limited: false }), deleteUser: async () => false });
  assert.equal((await handler(new Request('https://example.test', { method: 'OPTIONS' }))).status, 204);
  assert.equal((await handler(new Request('https://example.test'))).status, 405);
  assert.equal((await handler(new Request('https://example.test', { method: 'POST' }))).status, 401);
  assert.equal((await handler(new Request('https://example.test', { method: 'POST', headers: { Authorization: 'Bearer token' } }))).status, 415);
  assert.equal((await handler(request({ password: 'x'.repeat(3000) }))).status, 413);
  const response = await handler(request()); assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'deletion_failed' });
});
test('a failed administrative deletion never returns a success receipt', async () => {
  const handler = createDeletionHandler({ authenticate: async () => ({ id: 'a', email: 'a@example.test' }), verifyPassword: async () => ({ id: 'a', limited: false }), deleteUser: async () => false });
  const response = await handler(request()); assert.equal(response.status, 503); assert.deepEqual(await response.json(), { error: 'deletion_failed' });
});
test('cleanup drains in-flight writes, prevents cache resurrection and preserves guest/other accounts', async () => {
  const values = new Map([['arca.account.a.v1', 'private'], ['arca.account.a.v1.backup.123', 'private-backup'], ['arca.achievements.a.v1', 'private-achievement'], ['arca.account.b.v1', 'other'], ['arca.account.aa.v1', 'other'], ['arca.learning.v1', 'guest'], ['arca.achievements.guest.v1', 'guest-achievement'], ['@arca/sound-effects-enabled', 'false']]);
  let finish: (() => void) | undefined;
  const storage = createAccountStorage({ getItem: async key => values.get(key) ?? null, setItem: async (key, value) => { await new Promise<void>(resolve => { finish = resolve; }); values.set(key, value); }, getAllKeys: async () => [...values.keys()], multiRemove: async keys => { keys.forEach(key => values.delete(key)); } });
  const oldWrite = storage.setItem('arca.account.a.v1', 'late'); const cleanup = storage.clearUser('a');
  await assert.rejects(storage.setItem('arca.account.a.v1', 'resurrect'), /account_deletion_pending/);
  finish!(); await oldWrite; await cleanup;
  assert.equal(values.has('arca.account.a.v1'), false); assert.equal(values.has('arca.account.a.v1.backup.123'), false); assert.equal(values.has('arca.achievements.a.v1'), false);
  assert.equal(values.get('arca.account.b.v1'), 'other'); assert.equal(values.get('arca.account.aa.v1'), 'other'); assert.equal(values.get('arca.learning.v1'), 'guest'); assert.equal(values.get('@arca/sound-effects-enabled'), 'false');
  await assert.rejects(storage.setItem('arca.achievements.a.v1', 'late-achievement'), /account_deletion_pending/);
  storage.resumeUser('a'); const retry = storage.setItem('arca.account.a.v1', 'allowed-after-cancel'); finish!(); await retry;
});
async function serviceFixture() {
  const source = await readFile(new URL('../src/services/accountDeletion.ts', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const events: string[] = [];
  let user: string | null = 'a', failure: string | null = null, cleanFail = false, responseUser = 'a', changeUser = false, pushFail = false;
  const push = { detachDevicePush: async (id: string) => { events.push('revoke-push-' + id); if (pushFail) throw new Error('push cleanup'); } };
  const sessionStorage = { removeItem: async () => { events.push('clear-recovery'); } };
  const accountStorage = { pauseUser: async (id: string) => { events.push('pause-' + id); }, resumeUser: (id: string) => events.push('resume-' + id), clearUser: async (id: string) => { events.push('clear-' + id); if (cleanFail) throw new Error('disk'); } };
  const client = { auth: { getSession: async () => ({ data: { session: user ? { user: { id: user }, access_token: 'token-' + user } : null }, error: null }), signOut: async () => { events.push('logout-' + user); user = null; return { error: null }; } }, functions: { invoke: async (name: string, options: { headers: { Authorization: string }; body: unknown }) => {
    events.push('remote'); assert.equal(name, 'delete-account'); assert.equal(options.headers.Authorization, 'Bearer token-a'); assert.deepEqual(options.body, { password: 'test-password' });
    if (changeUser) user = 'b';
    return failure ? { data: null, error: { context: Response.json({ error: failure }) } } : { data: { deleted: true, userId: responseUser }, error: null };
  } } };
  const exports: { deleteAccount?: (id: string, password: string) => Promise<{ deleted: boolean; cleanupComplete: boolean }> } = {};
  new Function('require', 'exports', js)((name: string) => name.endsWith('accountStorage') ? { accountStorage } : name.endsWith('supabase') ? { requireSupabase: () => client } : name.endsWith('pushNotifications') ? push : { sessionStorage }, exports);
  return { events, remove: exports.deleteAccount!, set failure(value: string | null) { failure = value; }, set cleanFail(value: boolean) { cleanFail = value; }, set responseUser(value: string) { responseUser = value; }, set changeUser(value: boolean) { changeUser = value; }, set pushFail(value: boolean) { pushFail = value; } };
}
test('client erases local data only after an authenticated matching server receipt', async () => {
  for (const error of ['invalid_credentials', 'auth_required', 'deletion_failed']) {
    const f = await serviceFixture(); f.failure = error; await assert.rejects(f.remove('a', 'test-password'), new RegExp(error)); assert.deepEqual(f.events, ['pause-a', 'remote', 'resume-a']);
  }
  const mismatch = await serviceFixture(); mismatch.responseUser = 'b'; await assert.rejects(mismatch.remove('a', 'test-password'), /deletion_unconfirmed/); assert.equal(mismatch.events.includes('clear-a'), false);
  const f = await serviceFixture(); assert.deepEqual(await f.remove('a', 'test-password'), { deleted: true, cleanupComplete: true });
  assert.deepEqual(f.events, ['pause-a', 'remote', 'clear-a', 'revoke-push-a', 'logout-a', 'clear-recovery']);
});
test('cleanup retries do not delete twice and a late response never signs out the next account', async () => {
  const f = await serviceFixture(); f.cleanFail = true; assert.equal((await f.remove('a', 'test-password')).cleanupComplete, false);
  f.cleanFail = false; assert.equal((await f.remove('a', '')).cleanupComplete, true); assert.equal(f.events.filter(item => item === 'remote').length, 1);
  const switched = await serviceFixture(); switched.changeUser = true; await switched.remove('a', 'test-password'); assert.equal(switched.events.includes('logout-b'), false); assert.equal(switched.events.includes('clear-a'), true); assert.equal(switched.events.includes('revoke-push-b'), false);
  const push = await serviceFixture(); push.pushFail = true; assert.equal((await push.remove('a', 'test-password')).cleanupComplete, false); assert.ok(push.events.includes('logout-a'));
});
test('privacy and external pages identify the real owner, include a deletion path and never imply email auto-sending', async () => {
  assert.equal(privacyContact.controller, 'Matheus Sakai'); assert.equal(privacyContact.email, 'matheussakai23032001@gmail.com'); assert.ok(privacySections.length >= 8);
  const url = new URL(deletionRequestUrl('a+test@example.test')); assert.equal(url.protocol, 'mailto:'); assert.match(url.searchParams.get('body')!, /a\+test@example.test/);
  for (const file of ['index.html', 'excluir-conta.html']) {
    const html = await readFile(new URL('../legal-site/dist/' + file, import.meta.url), 'utf8'); assert.match(html, /Matheus Sakai/); assert.match(html, /matheussakai23032001@gmail.com/); assert.match(html, /excluir-conta.html/); assert.doesNotMatch(html, /SUPABASE_|service_role|sb_secret/);
    if (file === 'excluir-conta.html') assert.match(html, /action="mailto:matheussakai23032001@gmail.com" method="post"/);
  }
  const script = await readFile(new URL('../legal-site/dist/request.js', import.meta.url), 'utf8'); assert.match(script, /Nada foi enviado automaticamente/); assert.doesNotMatch(script, /fetch\(|XMLHttpRequest/);
  const entry = await readFile(new URL('../supabase/functions/delete-account/index.ts', import.meta.url), 'utf8'); assert.match(entry, /deleteUser\(id, false\)/); assert.doesNotMatch(entry, /console\.log|console\.error/);
  const handler = await readFile(new URL('../supabase/functions/delete-account/handler.ts', import.meta.url), 'utf8');
  assert.equal(await readFile(new URL('../artifacts/delete-account.function.ts', import.meta.url), 'utf8'), entry.replace("import { createDeletionHandler } from './handler.ts';", () => handler));
});
