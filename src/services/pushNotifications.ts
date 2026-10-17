import * as Notifications from 'expo-notifications';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { boundedPushOperation, createPushController, pushDestination, type PushPreferences } from '@/lib/pushNotifications';
import { pushRepository } from './pushRepository';

export const pushSupported = Platform.OS === 'android' && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
const channel = 'arca-updates';
const allowed = async () => (await Notifications.getPermissionsAsync()).granted;
const controller = createPushController({ storage: AsyncStorage, repository: pushRepository, device: {
  allowed,
  authorize: async () => {
    await Notifications.setNotificationChannelAsync(channel, { name: 'Energia e jornada', importance: Notifications.AndroidImportance.DEFAULT, sound: null, enableVibrate: false });
    return (await Notifications.requestPermissionsAsync()).granted;
  },
  token: async () => {
    if (typeof projectId !== 'string' || !projectId) throw new Error('Não foi possível identificar esta versão do Arca.');
    await Notifications.setNotificationChannelAsync(channel, { name: 'Energia e jornada', importance: Notifications.AndroidImportance.DEFAULT, sound: null, enableVibrate: false });
    try { return (await boundedPushOperation(Notifications.getExpoPushTokenAsync({ projectId }))).data; }
    catch { throw new Error('Não foi possível registrar os avisos deste aparelho. Confira a conexão e tente novamente.'); }
  },
  revoke: () => boundedPushOperation(Notifications.unregisterForNotificationsAsync()),
} });
if (pushSupported) Notifications.setNotificationHandler({ handleNotification: async notification => {
  const local = notification.request.content.data?.kind === 'study-reminder';
  return { shouldShowBanner: local, shouldShowList: local, shouldPlaySound: false, shouldSetBadge: false };
} });
export const loadPushPreferences = (owner: string) => controller.load(owner);
export const pushDeviceRegistered = (owner: string) => controller.registered(owner);
export const restoreDevicePush = async (owner: string) => { if (pushSupported) { await controller.activate(owner); await controller.sync(owner); } };
export const savePushPreferences = (owner: string, value: PushPreferences) => controller.save(owner, value);
export const detachDevicePush = async (owner?: string) => { if (pushSupported) await controller.detach(owner); };
export function bindPushAccount(owner: string | null) {
  if (!pushSupported) return () => undefined;
  void controller.activate(owner).then(() => owner ? controller.sync(owner) : undefined).catch(() => undefined);
  const refresh = () => { if (owner) void controller.sync(owner).catch(() => undefined); };
  const foreground = AppState.addEventListener('change', value => { if (value === 'active') refresh(); });
  const rotated = Notifications.addPushTokenListener(refresh);
  const timer = setInterval(() => { if (AppState.currentState === 'active') refresh(); }, 10 * 60 * 1000);
  return () => { foreground.remove(); rotated.remove(); clearInterval(timer); };
}
export function observePush(owner: string, navigate: (path: '/learn') => void) {
  function receive(response: Notifications.NotificationResponse) {
    const target = pushDestination(response.notification.request.content.data, owner);
    Notifications.clearLastNotificationResponse();
    if (target) navigate(target);
  }
  const last = Notifications.getLastNotificationResponse(); if (last) receive(last);
  const listener = Notifications.addNotificationResponseReceivedListener(receive);
  return () => listener.remove();
}
