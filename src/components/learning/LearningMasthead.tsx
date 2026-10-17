import type { ReactNode } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { redesignAssets } from '@/constants/redesignAssets';
import { LearningStats } from './LearningStats';

export function LearningMasthead({
  xp,
  streak,
  leading,
  appearance = 'scene',
}: {
  xp: number;
  streak: number;
  leading?: ReactNode;
  appearance?: 'scene' | 'trail';
}) {
  const trail = appearance === 'trail';
  return (
    <View style={[styles.header, trail && styles.trailHeader]}>
      <View style={styles.brandRow}>
        {leading}
        <Image
          source={redesignAssets.logoWhite}
          resizeMode="contain"
          accessible
          accessibilityLabel="Arca"
          style={[styles.logo, trail && styles.trailLogo]}
        />
      </View>
      <LearningStats xp={xp} streak={streak} motionKey="learn" />
    </View>
  );
}
const styles = StyleSheet.create({
  header: { gap: 24, paddingTop: 16, paddingHorizontal: 8, paddingBottom: 4 },
  logo: { width: 152, height: 52 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  trailHeader: {
    gap: 8,
    paddingTop: 8,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EFF1F5',
    backgroundColor: '#FFFFFF',
  },
  trailLogo: { width: 100, height: 34, tintColor: '#0964FF' },
});
