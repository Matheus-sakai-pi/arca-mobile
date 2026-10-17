import type { StorageDriver } from './chunkedStorage.ts';

export const legacyGuestBatteryKey = 'arca.battery.guest.token.v2';
type Failure = { code?: string; message: string };
type Result = { data: unknown; error: Failure | null };
type Args = { p_action: 'register' | 'status'; p_guest?: string };
const validToken = (token: unknown): token is string => typeof token === 'string' && /^[a-f0-9]{64}$/.test(token);
export const isRejectedGuestBattery = (error: Failure | null) => error?.code === 'P0001' && error.message === 'battery_guest_required';

export function guestBatteryKey(backend: string): string {
  // Hex keeps the backend-specific key compatible with native SecureStore.
  const scope = Array.from(new URL(backend).origin, char => char.charCodeAt(0).toString(16).padStart(2, '0')).join('');
  return `${legacyGuestBatteryKey}.${scope}`;
}

export function createGuestBatteryIdentity({ backend, storage, rpc, check }: {
  backend: string; storage: Pick<StorageDriver, 'getItem' | 'setItem'>;
  rpc: (args: Args) => PromiseLike<Result>; check: (error: Failure | null) => void;
}) {
  const key = guestBatteryKey(backend);
  let pending: Promise<string> | null = null;
  async function load() {
    const scoped = await storage.getItem(key);
    const legacy = await storage.getItem(legacyGuestBatteryKey);
    for (const token of new Set([scoped, legacy].filter(validToken))) {
      const { error } = await rpc({ p_action: 'status', p_guest: token });
      if (isRejectedGuestBattery(error)) continue;
      check(error);
      await storage.setItem(key, token);
      return token;
    }
    const { data, error } = await rpc({ p_action: 'register' });
    check(error);
    const token = data && typeof data === 'object' && 'guestToken' in data ? data.guestToken : null;
    if (!validToken(token)) throw new Error('Não foi possível guardar sua bateria de visitante.');
    await storage.setItem(key, token);
    return token;
  }
  return {
    async get(): Promise<string> {
      const task = pending ??= load();
      try { return await task; }
      catch (error) { if (pending === task) pending = null; throw error; }
    },
    async invalidate(rejectedToken: string) {
      const task = pending;
      if (task && await task.catch(() => null) === rejectedToken && pending === task) pending = null;
    },
  };
}
