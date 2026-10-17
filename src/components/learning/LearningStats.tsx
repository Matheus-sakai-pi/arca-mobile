import { Image, StyleSheet, View } from 'react-native';
import { Star } from 'lucide-react-native';
import { visualArtwork } from '@/constants/visualAssets';
import { AnimatedCounter } from '@/components/animation/AnimatedCounter';
import { RewardPulse } from '@/components/animation/RewardPulse';
import { useCounterMotion } from '@/providers/RewardMotionProvider';
import { colors, radius, spacing } from '@/constants/theme';
import { AppText } from '@/components/common/AppText';
import { EnergyMeter } from './EnergyMeter';

export function LearningStats({ xp, streak, motionKey='stats', entrance=false, appearance='default' }: { xp: number; streak: number;motionKey?:string;entrance?:boolean;appearance?:'default'|'ranking' }) {
  const xpMotion=useCounterMotion(`${motionKey}:xp`,xp,entrance,'xp');
  const streakMotion=useCounterMotion(`${motionKey}:streak`,streak,entrance,'streak');
  const showcase=appearance === 'ranking';
  return <View testID={showcase ? 'ranking-stats' : 'learning-stats'} style={[styles.stats,showcase && styles.showcase,styles.withEnergy]}>
    <View style={styles.metric} accessibilityLabel={`${streak} ${streak === 1 ? 'dia' : 'dias'} de sequência`}><RewardPulse event={streakMotion.to > streakMotion.from ? streakMotion.event : 0}><Image source={visualArtwork.streak} accessible={false} resizeMode="contain" style={{ width: showcase ? 28 : 24, height: showcase ? 28 : 24 }} /></RewardPulse><View style={showcase && styles.streakValue}><AnimatedCounter transition={streakMotion} duration={550} variant={showcase ? 'h2' : 'h3'} style={showcase ? [styles.showcaseValue,streak >= 1000 && styles.longValue] : undefined} haptic={!entrance} />{showcase ? <AppText variant="small" color={colors.muted} style={styles.dayLabel}>{streak === 1 ? 'dia' : 'dias'}</AppText> : null}</View></View>
    <View style={[styles.divider,showcase && styles.tallDivider]} />
    <View style={styles.metric} accessibilityLabel={`${xp} XP total`}><Star size={22} color={colors.goldInk} fill={colors.gold} /><AnimatedCounter transition={xpMotion} duration={700} variant={showcase ? 'h2' : 'h3'} style={[styles.compactValue,showcase && styles.showcaseValue,xp >= 100000 && styles.longValue]} suffix=" XP" bounce /></View>
    <View style={[styles.divider,showcase && styles.tallDivider]} />
    <EnergyMeter inline />
  </View>;
}
const styles = StyleSheet.create({
  stats: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, flexShrink: 1, boxShadow: '0 6px 18px rgba(47,101,191,0.09)' },
  metric: { flexDirection: 'row', gap: spacing.xs, alignItems: 'center', flexShrink: 1 },
  divider: { width: 1, height: 22, backgroundColor: colors.border },
  showcase: { minHeight: 68, maxWidth: '100%', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, gap: 12 },
  streakValue: { justifyContent: 'center', minWidth: 20 },
  tallDivider: { height: 32 },
  showcaseValue: { fontSize: 20, lineHeight: 26, fontVariant: ['tabular-nums'] },
  dayLabel: { fontSize: 12, lineHeight: 16 },
  longValue: { fontSize: 16, lineHeight: 22 },
  withEnergy: { maxWidth: '100%', gap: 10, paddingHorizontal: 14, paddingVertical: 5 },
  compactValue: { fontSize: 18, lineHeight: 24, fontVariant: ['tabular-nums'] },
});
