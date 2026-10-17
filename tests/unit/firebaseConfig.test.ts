import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('Firebase Android configuration matches the shipped package and keeps private credentials out of builds', async () => {
  const root = new URL('../../', import.meta.url);
  const config = JSON.parse(await readFile(new URL('app.json', root), 'utf8'));
  assert.equal(config.expo.android.googleServicesFile, './google-services.json');
  const firebase = JSON.parse(await readFile(new URL(config.expo.android.googleServicesFile, root), 'utf8'));
  assert.ok(firebase.client.some((client: { client_info: { android_client_info: { package_name: string } } }) => client.client_info.android_client_info.package_name === config.expo.android.package));
  assert.equal(firebase.project_info.project_id, 'arca-efe4b');
  assert.equal(firebase.configuration_version, '1');
  assert.equal(firebase.private_key, undefined);
  assert.notEqual(firebase.type, 'service_account');
  assert.ok(config.expo.plugins.includes('expo-notifications'));
  for (const file of ['.gitignore', '.easignore']) {
    const rules = await readFile(new URL(file, root), 'utf8');
    assert.ok(rules.includes('*firebase-adminsdk*.json'));
    assert.ok(rules.includes('*service-account*.json'));
    assert.ok(!rules.split(/\r?\n/).includes('google-services.json'));
  }
});
