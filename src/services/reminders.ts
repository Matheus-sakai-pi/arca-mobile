import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createReminderController, defaultReminder } from '@/lib/reminderStore';

export const remindersSupported = true;
const identifier = 'arca-daily-study';
const isAllowed = (result: Notifications.NotificationPermissionsStatus) =>
  result.granted || result.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
const controller = createReminderController(AsyncStorage, {
  allowed: async () => isAllowed(await Notifications.getPermissionsAsync()),
  authorize: async () => {
    if (Platform.OS === 'android')
      await Notifications.setNotificationChannelAsync('study-reminders', {
        name: 'Lembrete de estudo',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: null,
        enableVibrate: false,
      });
    return isAllowed(
      await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: false, allowSound: false },
      }),
    );
  },
  scheduled: async () =>
    (await Notifications.getAllScheduledNotificationsAsync()).some(item => item.identifier === identifier),
  cancel: () => Notifications.cancelScheduledNotificationAsync(identifier),
  schedule: async value => {
    if (Platform.OS === 'android')
      await Notifications.setNotificationChannelAsync('study-reminders', {
        name: 'Lembrete de estudo',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: null,
        enableVibrate: false,
      });
    await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title: 'Seu momento com o Arca',
        body: 'Que tal continuar sua jornada de estudo?',
        sound: false,
        data: { kind: 'study-reminder' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: value.hour,
        minute: value.minute,
        channelId: 'study-reminders',
      },
    });
  },
});
export const loadReminder = controller.load;
export const saveReminder = controller.save;
export { defaultReminder };
