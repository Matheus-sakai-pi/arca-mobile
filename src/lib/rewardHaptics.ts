import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
let enabled=true;
export function setRewardHapticsEnabled(value:boolean) {enabled=value;}
export function pressHaptic() {
  if (!enabled || Platform.OS === 'web') return;
  void Haptics.selectionAsync().catch(() => undefined);
}
export function rewardHaptic() {
  if(!enabled || Platform.OS === 'web') return;
  const task=Platform.OS === 'android' ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm) : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  void task.catch(()=>undefined);
}
