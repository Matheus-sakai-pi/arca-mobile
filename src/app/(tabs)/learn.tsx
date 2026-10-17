import { StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/common/Screen';
import { LearningGate } from '@/components/learning/LearningGate';
import { LearningMasthead } from '@/components/learning/LearningMasthead';
import { UnitCard } from '@/components/learning/UnitCard';
import { journeyUnits } from '@/data/lessons';
import { useLearning } from '@/providers/LearningProvider';

export default function Learn() { return <LearningGate><UnitsContent /></LearningGate>; }
function UnitsContent() {
  const { progress, unit: course, profile } = useLearning();
  if (!progress) return null;
  return <Screen scene="ark" style={styles.content}>
    <LearningMasthead xp={progress.xp} streak={profile?.current_streak ?? 0} />
    {journeyUnits(course).map((unit, index) => <UnitCard key={unit.id} unit={unit} index={index} course={course} progress={progress} onPress={() => router.push({ pathname: '/unit/[id]', params: { id: unit.id } })} />)}
  </Screen>;
}
const styles = StyleSheet.create({ content: { gap: 12, paddingBottom: 24 } });
