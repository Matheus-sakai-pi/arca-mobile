import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseAuthCallback } from '../src/lib/authCallback.ts';

test('native recovery links preserve both session tokens and recovery mode', () => {
  assert.deepEqual(parseAuthCallback('arca://auth/callback#access_token=access&refresh_token=refresh&type=recovery'), { accessToken: 'access', refreshToken: 'refresh', recovery: true });
});
test('web confirmation supports query parameters', () => {
  assert.equal(parseAuthCallback('http://localhost:8081/auth/callback?access_token=a&refresh_token=r&type=signup').recovery, false);
});
test('missing tokens and expired links fail before creating a session', () => {
  assert.throws(() => parseAuthCallback('arca://auth/callback#access_token=a'), /auth_link_invalid/);
  assert.throws(() => parseAuthCallback('arca://auth/callback#error=access_denied&error_code=otp_expired'), /auth_link_invalid/);
});
