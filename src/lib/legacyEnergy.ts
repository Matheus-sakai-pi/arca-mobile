// Historical v1 cache contracts, retained only for migration regression tests.
import { integer, object } from './backendDecoders.ts';
export const ENERGY_MAX = 5;
export const ENERGY_INTERVAL = 4 * 60 * 60 * 1000;
export const energyKey = (owner: string) => `arca.energy.${owner}.v1`;
export type EnergyState = { owner: string; available: boolean; enabled: boolean; balance: number; nextRefillAt: string | null; serverNow: string; reserved: boolean; cost: 0 | 1; allowed: boolean };
export type LocalEnergy = { version: 1; owner: string; balance: number; nextRefillAt: number | null; observedAt: number; lessons: string[] };
export function freshEnergy(owner: string, now = Date.now()): LocalEnergy { return { version: 1, owner, balance: ENERGY_MAX, nextRefillAt: null, observedAt: now, lessons: [] }; }
export function parseEnergy(raw: string | null, owner: string): LocalEnergy {
  if (raw === null) return freshEnergy(owner);
  const value: unknown = JSON.parse(raw);
  if (!object(value) || value.version !== 1 || value.owner !== owner || !integer(value.balance) || value.balance > ENERGY_MAX || !integer(value.observedAt)
    || !(value.nextRefillAt === null || integer(value.nextRefillAt)) || value.balance === ENERGY_MAX && value.nextRefillAt !== null || value.balance < ENERGY_MAX && value.nextRefillAt === null
    || !Array.isArray(value.lessons) || value.lessons.length > 200 || value.lessons.some(id => typeof id !== 'string' || !id || id.length > 200) || new Set(value.lessons).size !== value.lessons.length) throw new Error('Não foi possível ler sua energia. Seus dados continuam guardados.');
  return value as LocalEnergy;
}
export function recoverEnergy(value: LocalEnergy, now = Date.now()): LocalEnergy {
  // A backwards clock cannot earn energy or reset the recovery anchor.
  const time = Math.max(now, value.observedAt);
  if (value.nextRefillAt === null || time < value.nextRefillAt) return { ...value, observedAt: time };
  const ticks = Math.min(ENERGY_MAX, 1 + Math.floor((time - value.nextRefillAt) / ENERGY_INTERVAL));
  const balance = Math.min(ENERGY_MAX, value.balance + ticks);
  return { ...value, balance, observedAt: time, nextRefillAt: balance === ENERGY_MAX ? null : value.nextRefillAt + ticks * ENERGY_INTERVAL };
}
export function localEnergyState(value: LocalEnergy, free = true, reserved = false): EnergyState {
  return { owner: value.owner, available: true, enabled: true, balance: value.balance, nextRefillAt: value.nextRefillAt === null ? null : new Date(value.nextRefillAt).toISOString(),
    serverNow: new Date(value.observedAt).toISOString(), reserved, cost: free || reserved ? 0 : 1, allowed: true };
}
export function decodeEnergy(value: unknown, owner: string): EnergyState {
  if (!object(value) || value.owner !== owner || value.available !== true || typeof value.enabled !== 'boolean' || !integer(value.balance) || value.balance > ENERGY_MAX
    || typeof value.serverNow !== 'string' || !Number.isFinite(Date.parse(value.serverNow)) || !(value.nextRefillAt === null || typeof value.nextRefillAt === 'string' && Number.isFinite(Date.parse(value.nextRefillAt)))
    || typeof value.reserved !== 'boolean' || ![0, 1].includes(Number(value.cost)) || typeof value.cost !== 'number' || typeof value.allowed !== 'boolean'
    || value.balance === ENERGY_MAX && value.nextRefillAt !== null || value.balance < ENERGY_MAX && value.nextRefillAt === null) throw new Error('Saldo de energia inválido. Tente atualizar novamente.');
  return value as EnergyState;
}
export function createGuestEnergyStore(storage: { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> }, now = Date.now) {
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(fn: () => Promise<T>) => { const next = queue.then(fn); queue = next.catch(() => undefined); return next; };
  async function read() { return recoverEnergy(parseEnergy(await storage.getItem(energyKey('guest')), 'guest'), now()); }
  return {
    load: (legacyLessons: string[] = []) => serial(async () => {
      const raw = await storage.getItem(energyKey('guest'));
      const value = recoverEnergy(raw === null ? { ...freshEnergy('guest', now()), lessons: [...new Set(legacyLessons)] } : parseEnergy(raw, 'guest'), now());
      await storage.setItem(energyKey('guest'), JSON.stringify(value)); return value;
    }),
    begin: (lesson: string, free: boolean) => serial(async () => {
      const value = await read(), reserved = value.lessons.includes(lesson);
      if (!free && !reserved && value.balance === 0) return { ...localEnergyState(value, free, reserved), allowed: false };
      const charge = !free && !reserved;
      const next = { ...value, balance: value.balance - Number(charge), nextRefillAt: charge ? value.nextRefillAt ?? value.observedAt + ENERGY_INTERVAL : value.nextRefillAt,
        lessons: reserved ? value.lessons : [...value.lessons, lesson] };
      await storage.setItem(energyKey('guest'), JSON.stringify(next));
      return localEnergyState(next, free, true);
    }),
  };
}
export function energyWait(state: EnergyState, receivedAt: number, now = Date.now()): string {
  if (!state.nextRefillAt) return 'Energia completa';
  const remaining = Math.max(0, Date.parse(state.nextRefillAt) - Date.parse(state.serverNow) - Math.max(0, now - receivedAt));
  if (remaining === 0) return 'Atualize para conferir a recarga';
  const minutes = Math.ceil(remaining / 60000), hours = Math.floor(minutes / 60);
  return hours ? `${hours}h ${minutes % 60}min` : `${minutes}min`;
}
