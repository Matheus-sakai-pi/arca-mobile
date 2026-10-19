import { StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/common/Screen';
import { LearningGate } from '@/components/learning/LearningGate';
import { LearningStats } from '@/components/learning/LearningStats';
import { AppText } from '@/components/common/AppText';
import { UnitCard } from '@/components/learning/UnitCard';
import { journeyUnits } from '@/data/lessons';
import { useLearning } from '@/providers/LearningProvider';

export default function Learn() { return <LearningGate><UnitsContent /></LearningGate>; }
function UnitsContent() {
  const { progress, unit: course, profile } = useLearning();
  if (!progress) return null;
  return <Screen style={styles.content}>
    <AppText variant="h1" accessibilityRole="header">Aprender</AppText>
    <LearningStats xp={progress.xp} streak={profile?.current_streak ?? 0} motionKey="learn" />
    {journeyUnits(course).map((unit, index) => <UnitCard key={unit.id} unit={unit} index={index} course={course} progress={progress} onPress={() => router.push({ pathname: '/unit/[id]', params: { id: unit.id } })} />)}
  </Screen>;
}
const styles = StyleSheet.create({ content: { gap: 12, paddingBottom: 24 } });
