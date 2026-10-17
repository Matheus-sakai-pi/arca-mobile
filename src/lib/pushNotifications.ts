export type PushPreferences = { energy: boolean; comeback: boolean; timezone: string };
export const defaultPushPreferences: PushPreferences = { energy: false, comeback: false, timezone: 'America/Sao_Paulo' };
export const pushDeviceKey = 'arca.push.device.v1';
export const validPushToken = (token: string) => /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{10,200}\]$/.test(token);
export async function boundedPushOperation<T>(operation: Promise<T>, milliseconds = 12000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([operation, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Não foi possível concluir o registro de avisos. Tente novamente.')), milliseconds); })]); }
  finally { clearTimeout(timer); }
}
export function decodePushPreferences(value: unknown): PushPreferences {
  if (!value || typeof value !== 'object' || !('energy' in value) || typeof value.energy !== 'boolean'
    || !('comeback' in value) || typeof value.comeback !== 'boolean' || !('timezone' in value)
    || typeof value.timezone !== 'string' || value.timezone.length > 100) throw new Error('Preferências de avisos inválidas.');
  try { new Intl.DateTimeFormat('en', { timeZone: value.timezone }); } catch { throw new Error('Fuso horário inválido.'); }
  return { energy: value.energy, comeback: value.comeback, timezone: value.timezone };
}
export function pushDestination(data: unknown, owner: string | null): '/learn' | null {
  if (!owner || !data || typeof data !== 'object' || !('kind' in data)) return null;
  if (data.kind === 'study-reminder') return '/learn';
  return (data.kind === 'energy' || data.kind === 'comeback') && 'owner' in data && data.owner === owner ? '/learn' : null;
}
type DeviceRecord = { owner: string; token: string; confirmed: boolean };
type Repository = { load: () => Promise<PushPreferences>; save: (value: PushPreferences) => Promise<PushPreferences>; register: (token: string, previous?: string) => Promise<void>; remove: (token: string) => Promise<void> };
type Dependencies = {
  storage: { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<void>; removeItem: (key: string) => Promise<void> };
  device: { allowed: () => Promise<boolean>; authorize: () => Promise<boolean>; token: () => Promise<string>; revoke: () => Promise<void> };
  repository: (owner: string) => Repository;
};
export function createPushController({ storage, device, repository }: Dependencies) {
  let current: string | null = null, generation = 0, queue: Promise<unknown> = Promise.resolve();
  function serial<T>(work: () => Promise<T>): Promise<T> { const next = queue.then(work); queue = next.catch(() => undefined); return next; }
  async function record(): Promise<DeviceRecord | null> {
    const raw = await storage.getItem(pushDeviceKey); if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || !('owner' in value) || typeof value.owner !== 'string'
      || !('token' in value) || typeof value.token !== 'string' || !validPushToken(value.token)) throw new Error('Não foi possível ler o registro de avisos deste aparelho.');
    return { owner: value.owner, token: value.token, confirmed: 'confirmed' in value && value.confirmed === true };
  }
  async function revoke(value: DeviceRecord | null) {
    let remote = !value, native = false;
    if (value) try { await repository(value.owner).remove(value.token); remote = true; } catch { /* Local invalidation also prevents delivery. */ }
    try { await device.revoke(); native = true; } catch { /* A successful server revocation is sufficient. */ }
    if (!remote && !native) throw new Error('Não foi possível desativar os avisos deste aparelho. Confira a conexão e tente novamente.');
    await storage.removeItem(pushDeviceKey);
  }
  function guard(owner: string, revision: number) { if (owner !== current || revision !== generation) throw new Error('Sua conta mudou. Abra os avisos novamente.'); }
  async function register(owner: string, revision: number) {
    guard(owner, revision);
    const previous = await record();
    const token = await device.token(); if (!validPushToken(token)) throw new Error('Não foi possível registrar este aparelho.');
    guard(owner, revision);
    // Persist before the request, so logout can revoke a registration whose response was lost.
    await storage.setItem(pushDeviceKey, JSON.stringify({ owner, token, confirmed: false }));
    guard(owner, revision);
    await repository(owner).register(token, previous?.owner === owner ? previous.token : undefined);
    guard(owner, revision);
    await storage.setItem(pushDeviceKey, JSON.stringify({ owner, token, confirmed: true }));
  }
  const sync = (owner: string) => {
    const revision = generation;
    return serial(async () => {
      guard(owner, revision);
      const previous = await record();
      if (previous && previous.owner !== owner) await revoke(previous);
      const prefs = await repository(owner).load(); guard(owner, revision);
      if (!(prefs.energy || prefs.comeback) || !await device.allowed()) { if (previous) await revoke(previous); return; }
      await register(owner, revision);
    });
  };
  return {
    activate(owner: string | null) {
      current = owner; generation++;
      return serial(async () => { const previous = await record(); if (previous && previous.owner !== owner) await revoke(previous); });
    },
    sync,
    load: (owner: string) => repository(owner).load(),
    registered: async (owner: string) => { const value = await record(); return value?.owner === owner && value.confirmed && await device.allowed(); },
    save(owner: string, input: PushPreferences) {
      const revision = generation;
      return serial(async () => {
        guard(owner, revision); const value = decodePushPreferences(input);
        if ((value.energy || value.comeback) && !await device.allowed() && !await device.authorize()) throw new Error('Permita as notificações nas configurações do aparelho para ativar os avisos.');
        guard(owner, revision);
        const saved = await repository(owner).save(value); guard(owner, revision);
        if (saved.energy || saved.comeback) await register(owner, revision);
        else await revoke(await record());
        return saved;
      });
    },
    detach(expectedOwner?: string) {
      if (expectedOwner && current !== expectedOwner) return Promise.resolve();
      current = null; generation++;
      return serial(async () => {
        let previous: DeviceRecord | null;
        try { previous = await record(); }
        catch { await device.revoke(); await storage.removeItem(pushDeviceKey); return; }
        await revoke(previous);
      });
    },
  };
}
