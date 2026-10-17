import { StyleSheet, View } from 'react-native';
import { Check, LockKeyhole, Play } from 'lucide-react-native';
import type { LessonStatus } from '@/types/learning';
import { darkerTrailColor } from '@/lib/trailAppearance';

export function TrailCoin({ lessonId, status, color }: { lessonId: string; status: LessonStatus; color: string }) {
  const locked = status === 'locked';
  const face = locked ? '#E4E6E9' : color;
  const Icon = locked ? LockKeyhole : status === 'completed' ? Check : Play;
  return <View testID={`journey-coin-${lessonId}`} style={styles.coin}>
    <View testID={`journey-coin-side-${lessonId}`} style={[styles.side, { backgroundColor: locked ? '#B9BEC6' : darkerTrailColor(color) }]} />
    <View testID={`journey-coin-face-${lessonId}`} style={[styles.face, { backgroundColor: face }]}>
      <Icon size={locked ? 36 : 44} color={locked ? '#9CA3AE' : '#FFFFFF'} strokeWidth={locked ? 3.2 : 4.5} fill={!locked && status !== 'completed' ? '#FFFFFF' : 'none'} />
    </View>
  </View>;
}
const styles = StyleSheet.create({
  coin: { width: 96, height: 96 },
  side: { position: 'absolute', top: 14, left: 0, width: 96, height: 80, borderRadius: 48 },
  face: { position: 'absolute', top: 1, left: 0, width: 96, height: 80, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
});
