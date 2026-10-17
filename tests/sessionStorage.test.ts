import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createChunkedStorage, type StorageDriver } from '../src/lib/chunkedStorage.ts';
function setup() {
  const data = new Map<string, string>();
  const driver: StorageDriver = {
    async getItem(key) { return data.get(key) ?? null; },
    async setItem(key, value) { data.set(key, value); },
    async removeItem(key) { data.delete(key); },
  };
  return { data, driver, storage: createChunkedStorage(driver) };
}
test('large Unicode sessions round-trip within secure storage size limits', async () => {
  const { data, storage } = setup();
  const value = JSON.stringify({ access_token: 'a'.repeat(5000), display_name: 'João'.repeat(800) });
  await storage.setItem('session', value);
  assert.equal(await storage.getItem('session'), value);
  for (const chunk of data.values()) assert.ok(Buffer.byteLength(chunk, 'utf8') < 2048);
});
test('replacing a session cleans previous chunks and logout removes everything', async () => {
  const { data, storage } = setup();
  await storage.setItem('session', 'a'.repeat(4000));
  await storage.setItem('session', 'new-session');
  assert.equal(await storage.getItem('session'), 'new-session');
  assert.equal(data.size, 2);
  await storage.removeItem('session');
  assert.equal(data.size, 0);
  assert.equal(await storage.getItem('session'), null);
});
test('interrupted writes preserve the previous committed session', async () => {
  const { driver, storage } = setup();
  await storage.setItem('session', 'original');
  const originalSetter = driver.setItem;
  let writes = 0;
  driver.setItem = async (key, value) => { if (++writes === 2) throw new Error('Storage failure'); await originalSetter(key, value); };
  await assert.rejects(() => storage.setItem('session', 'x'.repeat(3000)), /Storage failure/);
  assert.equal(await storage.getItem('session'), 'original');
});
test('missing chunks and corrupt manifests cannot produce partial sessions', async () => {
  const { data, storage } = setup();
  data.set('session', '{bad JSON');
  assert.equal(await storage.getItem('session'), null);
  await storage.setItem('session', 'a'.repeat(1000));
  const chunkKey = [...data.keys()].find(key => key !== 'session');
  assert.ok(chunkKey);
  data.delete(chunkKey);
  assert.equal(await storage.getItem('session'), null);
});
