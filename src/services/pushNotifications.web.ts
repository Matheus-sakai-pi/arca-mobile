import { defaultPushPreferences, type PushPreferences } from '@/lib/pushNotifications';
export const pushSupported = false;
export async function loadPushPreferences(_owner: string) {
  return { ...defaultPushPreferences };
}
export async function savePushPreferences(_owner: string, _value: PushPreferences): Promise<PushPreferences> {
  throw new Error('Os avisos automáticos estão disponíveis no aplicativo Android.');
}
export async function enableEnergyAlerts(_owner: string): Promise<PushPreferences> {
  throw new Error('Os avisos automáticos estão disponíveis no aplicativo Android.');
}
export async function detachDevicePush(_owner?: string) {}
export async function pushDeviceRegistered(_owner: string) {
  return false;
}
export async function restoreDevicePush(_owner: string) {}
export function bindPushAccount(_owner: string | null) {
  return () => undefined;
}
export function observePush(_owner: string, _navigate: (path: '/learn') => void) {
  return () => undefined;
}
