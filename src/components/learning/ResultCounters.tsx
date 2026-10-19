import { StyleSheet, View } from 'react-native';
import { CheckCircle2, Target, Star } from '@/components/icons';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { AppText } from '@/components/common/AppText';
import { AnimatedCounter } from '@/components/animation/AnimatedCounter';
import { AnimatedProgressBar } from '@/components/animation/AnimatedProgressBar';
import { useCounterMotion } from '@/providers/RewardMotionProvider';
import type { LessonResult } from '@/types/learning';
import { colors, spacing } from '@/constants/theme';
import { resultMotion } from '@/constants/motion';
import { useMotionPreference } from '@/hooks/useMotionPreference';
export function ResultCounters({ result }: { result: LessonResult }) {
  const reduced = useMotionPreference();
  const correct = useCounterMotion(`result:${result.attemptId}:correct`, result.correct, true);
  const accuracy = useCounterMotion(`result:${result.attemptId}:accuracy`, result.accuracy, true);
  const xp = useCounterMotion(`result:${result.attemptId}:xp`, result.xpEarned, true);
  const motion = reduced ? ReduceMotion.Always : ReduceMotion.System;
  return (
    <View testID="result-counters" style={styles.results}>
      <Animated.View
        entering={FadeInDown.delay(resultMotion.reward).duration(resultMotion.duration).reduceMotion(motion)}
        style={styles.reward}
      >
        <Star color={colors.goldInk} fill={colors.gold} size={32} />
        <AnimatedCounter
          transition={xp}
          prefix="+"
          suffix=" XP"
          delay={resultMotion.reward}
          duration={500}
          variant="display"
          color={colors.goldInk}
          bounce
          haptic
        />
        <AppText variant="small" color={colors.muted}>
          {result.xpEarned ? 'XP conquistado' : 'Sem XP adicional'}
        </AppText>
      </Animated.View>
      <Animated.View
        entering={FadeInDown.delay(resultMotion.stats).duration(resultMotion.duration).reduceMotion(motion)}
        style={styles.stats}
      >
        <View style={styles.stat}>
          <CheckCircle2 color={colors.success} size={22} />
          <AnimatedCounter
            transition={correct}
            suffix={`/${result.total}`}
            delay={resultMotion.stats}
            duration={400}
            variant="h2"
          />
          <AppText variant="small" color={colors.muted}>
            corretas
          </AppText>
        </View>
        <View style={styles.divider} />
        <View style={styles.stat}>
          <Target color={colors.tealInk} size={22} />
          <AnimatedCounter
            transition={accuracy}
            suffix="%"
            delay={resultMotion.stats}
            duration={400}
            variant="h2"
          />
          <AppText variant="small" color={colors.muted}>
            precisão
          </AppText>
          <AnimatedProgressBar
            compact
            value={accuracy.to}
            from={accuracy.from}
            delay={resultMotion.stats}
            duration={400}
            label="Precisão da lição"
          />
        </View>
      </Animated.View>
    </View>
  );
}
const styles = StyleSheet.create({
  results: { width: '100%', gap: spacing.md },
  reward: { alignItems: 'center', gap: spacing.xxs, paddingVertical: spacing.sm },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  stat: { flex: 1, minWidth: 0, alignItems: 'center', gap: spacing.xxs },
  divider: { width: 1, backgroundColor: colors.border },
});
