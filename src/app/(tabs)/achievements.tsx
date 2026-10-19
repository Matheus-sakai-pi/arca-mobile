import { StyleSheet, View } from 'react-native';
import { BookOpen, CheckCircle2, Flame } from '@/components/icons';
import { AchievementsSection } from '@/components/profile/AchievementsSection';
import { AnimatedCounter } from '@/components/animation/AnimatedCounter';
import { useCounterMotion } from '@/providers/RewardMotionProvider';
import { LearningGate } from '@/components/learning/LearningGate';
import { Screen } from '@/components/common/Screen';
import { AppText } from '@/components/common/AppText';
import { journeyUnits } from '@/data/lessons';
import { useLearning } from '@/providers/LearningProvider';
import { colors, spacing, surfaces } from '@/constants/theme';

export default function Achievements() {
  return <LearningGate><AchievementsContent /></LearningGate>;
}
function AchievementsContent() {
  const { profile, progress, unit } = useLearning();
  const completedUnits = journeyUnits(unit).filter(item =>
    item.lessons.every(lesson => progress?.completedLessonIds.includes(lesson.id)),
  ).length;
  const stats = [
    { label: 'Lições', value: progress?.completedLessonIds.length ?? 0, Icon: CheckCircle2 },
    { label: 'Unidades', value: completedUnits, Icon: BookOpen },
    { label: 'Maior sequência', value: profile?.longest_streak ?? 0, Icon: Flame },
  ];
  return (
    <Screen>
      <AppText variant="h1" accessibilityRole="header">
        Conquistas
      </AppText>
      <View testID="achievement-stats" style={styles.stats}>
        {stats.map(({ label, value, Icon }) => (
          <View key={label} style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
            <Icon size={34} />
            <Counter label={label} value={value} />
            <AppText variant="small" color={colors.muted} style={styles.center}>
              {label}
            </AppText>
          </View>
        ))}
      </View>
      <AchievementsSection />
    </Screen>
  );
}
function Counter({ label, value }: { label: string; value: number }) {
  const transition = useCounterMotion(`achievements:${label}`, value, true);
  return <AnimatedCounter transition={transition} variant="h2" duration={650} />;
}
const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: { ...surfaces.tactile, flex: 1, minWidth: 0, alignItems: 'center', gap: 2, paddingVertical: spacing.md, paddingHorizontal: spacing.xs },
  center: { textAlign: 'center' },
});
