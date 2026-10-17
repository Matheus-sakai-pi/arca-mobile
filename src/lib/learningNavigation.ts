import { router } from 'expo-router';

export function returnToTrail() {
  if (router.canDismiss()) {
    router.dismissAll();
    router.navigate('/(tabs)/learn');
  } else {
    router.replace('/(tabs)/learn');
  }
}
