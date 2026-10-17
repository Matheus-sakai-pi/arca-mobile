import { Image, StyleSheet, View } from 'react-native';
import { achievementArtwork } from '@/constants/achievementArtwork';
import type { AchievementId } from '@/lib/achievements';

export function AchievementIcon({ id, unlocked = true, size = 72 }: { id: AchievementId; unlocked?: boolean; size?: number }) {
  return <View testID={`achievement-icon-${id}`} pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.frame, { width: size, height: size }, !unlocked && styles.locked]}>
    <Image source={achievementArtwork[id]} accessible={false} resizeMode="contain" style={styles.image} />
  </View>;
}

const styles = StyleSheet.create({
  frame: { flexShrink: 0 },
  image: { width: '100%', height: '100%' },
  locked: { opacity: 0.55 },
});
