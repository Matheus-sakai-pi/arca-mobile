import assert from 'node:assert/strict';
import { test } from 'node:test';
import { authErrorMessage, validateAuth, type AuthValues } from '../src/services/validation.ts';
const valid: AuthValues = { name: 'Matheus', email: ' matheus@example.com ', password: 'Jornada123!', confirmPassword: 'Jornada123!' };

test('signup validates a trimmed name and email', () => { assert.deepEqual(validateAuth('signup', valid), {}); });
test('signup rejects blank names, invalid emails, short and mismatched passwords', () => {
  const errors = validateAuth('signup', { name: ' ', email: 'wrong', password: '123', confirmPassword: '456' });
  assert.deepEqual(Object.keys(errors).sort(), ['confirmPassword', 'email', 'name', 'password']);
});
test('login accepts existing passwords shorter than the signup policy', () => { assert.deepEqual(validateAuth('login', { ...valid, password: 'old' }), {}); });
test('login requires a password', () => { assert.ok(validateAuth('login', { ...valid, password: '' }).password); });
test('recovery only validates email; reset only validates the new passwords', () => {
  assert.deepEqual(validateAuth('forgot', { ...valid, password: '', confirmPassword: '' }), {});
  assert.deepEqual(validateAuth('reset', { ...valid, name: '', email: '' }), {});
});
test('errors expose useful Portuguese copy without leaking backend internals', () => {
  assert.match(authErrorMessage({ code: 'invalid_credentials' }), /E-mail ou senha/);
  assert.match(authErrorMessage(new Error('Network request failed')), /internet/);
  assert.match(authErrorMessage(new Error('auth_not_configured')), /sem entrar/);
  assert.doesNotMatch(authErrorMessage(new Error('private database detail')), /private/);
});
