import assert from 'node:assert/strict';
import { test } from 'node:test';
import { publicBuildValues } from '../scripts/configure-eas-production.mjs';

const url = 'https://test-project.supabase.co';
const jwt = (payload: object) => 'header.' + Buffer.from(JSON.stringify(payload)).toString('base64url') + '.signature';
test('cloud build configuration uploads only the existing public project URL and anon key', () => {
  const key = jwt({ role: 'anon', ref: 'test-project' });
  const values = publicBuildValues({ EXPO_PUBLIC_SUPABASE_URL: url, EXPO_PUBLIC_SUPABASE_ANON_KEY: key, EXPO_PUBLIC_AUTH_REDIRECT_URL: 'http://localhost:8084/auth/callback', DATABASE_PASSWORD: 'never-upload' });
  assert.deepEqual(values, { EXPO_PUBLIC_SUPABASE_URL: url, EXPO_PUBLIC_SUPABASE_ANON_KEY: key, EXPO_PUBLIC_AUTH_REDIRECT_URL: 'arca://auth/callback' });
});
test('cloud configuration refuses secret, service-role, mismatched and missing values', () => {
  for (const key of ['sb_secret_test', jwt({ role: 'service_role', ref: 'test-project' }), jwt({ role: 'anon', ref: 'another-project' }), '', 'invalid']) {
    assert.throws(() => publicBuildValues({ EXPO_PUBLIC_SUPABASE_URL: url, EXPO_PUBLIC_SUPABASE_ANON_KEY: key }));
  }
  assert.throws(() => publicBuildValues({ EXPO_PUBLIC_SUPABASE_URL: 'http://localhost:54321', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_test' }));
  assert.throws(() => publicBuildValues({ EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_test' }));
});
test('public publishable keys are allowed without copying any server credentials', () => {
  assert.deepEqual(publicBuildValues({ EXPO_PUBLIC_SUPABASE_URL: url, EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_test', SERVICE_ROLE_KEY: 'private' }), { EXPO_PUBLIC_SUPABASE_URL: url, EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_test', EXPO_PUBLIC_AUTH_REDIRECT_URL: 'arca://auth/callback' });
});
