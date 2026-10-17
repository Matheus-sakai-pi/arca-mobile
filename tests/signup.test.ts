import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';
import { normalizeUsername } from '../src/lib/username.ts';

test('signup preserves the real server session without sending confirmation or admin requests', async () => {
  const source = await readFile(new URL('../src/services/auth.ts', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const calls: unknown[] = [];
  let taken=false;
  const session = { access_token: 'test-token', user: { id: 'new-user' } };
  let result = { data: { user: { id: 'new-user' }, session: session as typeof session | null }, error: null as Error | null };
  const auth = { signUp: async (input: unknown) => { calls.push(input); return result; } };
  const exports: { signUp?: (name: string, email: string, password: string) => Promise<typeof result.data> } = {};
  new Function('require', 'exports', 'process', js)(
    (name: string) => name === 'expo-linking' ? { createURL: () => 'arca://auth/callback' }
      : name === '@/lib/supabase' ? { requireSupabase: () => ({ auth }) }
      : name === '@/lib/username' ? {normalizeUsername}
      : name === './username' ? {assertUsernameAvailable:async()=>{if(taken) throw new Error('username_taken');}} : {},
    exports, { env: {} },
  );
  assert.equal((await exports.signUp!(' Maria ', ' MARIA@example.com ', 'strong-password')).session, session);
  assert.deepEqual(calls[0], { email: 'maria@example.com', password: 'strong-password', options: { data: { username:'maria',display_name: '@maria' }, emailRedirectTo: 'arca://auth/callback' } });
  result = { data: { user: { id: 'new-user' }, session: null }, error: null };
  assert.equal((await exports.signUp!('Maria', 'maria@example.com', 'strong-password')).session, null);
  const error = new Error('email_exists'); result = { ...result, error };
  await assert.rejects(exports.signUp!('Maria', 'maria@example.com', 'strong-password'), error);
  taken=true;
  const before=calls.length;
  await assert.rejects(exports.signUp!('Maria','maria@example.com','strong-password'),/username_taken/);
  assert.equal(calls.length,before,'Taken handles must not create an auth account');
  const form = await readFile(new URL('../src/components/auth/AuthForm.tsx', import.meta.url), 'utf8');
  assert.match(form, /if \(!result\.session\) router\.replace/);
  assert.doesNotMatch(source, /auth\.admin|email_confirm\s*:\s*true/);
});
