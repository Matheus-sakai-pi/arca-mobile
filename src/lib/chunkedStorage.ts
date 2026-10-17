export type StorageDriver = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};
type Manifest = { version: string; count: number };
let sequence = 0;
const chunkSize = 450;

function parseManifest(value: string | null): Manifest | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== 'object' || parsed === null || !('version' in parsed) || !('count' in parsed)) return null;
    if (typeof parsed.version !== 'string' || !/^[a-z0-9-]+$/.test(parsed.version) || typeof parsed.count !== 'number' || !Number.isInteger(parsed.count) || parsed.count < 1 || parsed.count > 256) return null;
    return { version: parsed.version, count: parsed.count };
  } catch { return null; }
}

// Commit the manifest last so an interrupted write cannot replace a valid session.
export function createChunkedStorage(driver: StorageDriver): StorageDriver {
  const partKey = (key: string, manifest: Manifest, i: number) => `${key}.${manifest.version}.${i}`;
  const removeParts = async (key: string, manifest: Manifest | null) => {
    if (manifest) await Promise.all(Array.from({ length: manifest.count }, (_, i) => driver.removeItem(partKey(key, manifest, i))));
  };
  return {
    async getItem(key) {
      const manifest = parseManifest(await driver.getItem(key));
      if (!manifest) return null;
      const parts = await Promise.all(Array.from({ length: manifest.count }, (_, i) => driver.getItem(partKey(key, manifest, i))));
      return parts.some(part => part === null) ? null : parts.join('');
    },
    async setItem(key, value) {
      const old = parseManifest(await driver.getItem(key));
      const manifest = { version: `${Date.now().toString(36)}-${(++sequence).toString(36)}`, count: Math.max(1, Math.ceil(value.length / chunkSize)) };
      if (manifest.count > 256) throw new Error('Session storage limit exceeded');
      try {
        for (let i = 0; i < manifest.count; i++) await driver.setItem(partKey(key, manifest, i), value.slice(i * chunkSize, (i + 1) * chunkSize));
        await driver.setItem(key, JSON.stringify(manifest));
      } catch (error) {
        await removeParts(key, manifest).catch(() => undefined);
        throw error;
      }
      await removeParts(key, old).catch(() => undefined);
    },
    async removeItem(key) {
      const old = parseManifest(await driver.getItem(key));
      await driver.removeItem(key);
      await removeParts(key, old);
    },
  };
}
