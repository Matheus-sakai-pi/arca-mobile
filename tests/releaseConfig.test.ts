import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';

test('store build is an AAB with production environment and internal submission stays draft', async () => {
  const config = JSON.parse(await readFile(new URL('../eas.json', import.meta.url), 'utf8'));
  assert.equal(config.build.production.android.buildType, 'app-bundle');
  assert.equal(config.build.production.environment, 'production');
  assert.equal(config.build.production.autoIncrement, true);
  assert.equal(config.submit.internal.android.track, 'internal');
  assert.equal(config.submit.internal.android.releaseStatus, 'draft');
  assert.equal(config.submit.production, undefined, 'do not enable public submission implicitly');
});

test('cloud build excludes local environments, signing secrets, references and QA material', async () => {
  const ignore = (await readFile(new URL('../.easignore', import.meta.url), 'utf8')).split(/\r?\n/);
  for (const path of ['.env*', '*.jks', '*.keystore', '*.key', '*.pem', 'credentials.json', '*service-account*.json', '/artifacts/', '/tests/', '/scripts/', '/supabase/', '/sources/', '/*.txt']) {
    assert.ok(ignore.includes(path), path);
  }
  assert.ok(!ignore.includes('/src/') && !ignore.includes('/assets/') && !ignore.includes('package-lock.json'));
  const routes = await readdir(new URL('../src/app/', import.meta.url));
  assert.ok(!routes.some(name => /^qa-/.test(name)), 'temporary visual QA routes must not ship');
});

test('native asset peer dependency is installed directly for audio in standalone builds', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const app = JSON.parse(await readFile(new URL('../app.json', import.meta.url), 'utf8'));
  assert.ok(pkg.dependencies['expo-audio']);
  assert.ok(pkg.dependencies['expo-asset'], 'Expo Go bundling a module is not enough for the store binary');
  assert.ok(app.expo.plugins.includes('expo-asset'));
});
