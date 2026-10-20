import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen } from '@/components/common/Screen';
import { LearningGate } from '@/components/learning/LearningGate';
import { LearningMasthead } from '@/components/learning/LearningMasthead';
import { JourneyTrail } from '@/components/learning/JourneyTrail';
import { UnitBanner } from '@/components/learning/UnitBanner';
import { journeyUnits } from '@/data/lessons';
import { unitTrailTheme } from '@/lib/trailAppearance';
import { useLearning } from '@/providers/LearningProvider';
import { useMotionPreference } from '@/hooks/useMotionPreference';

export default function Learn() { return <LearningGate><Journey /></LearningGate>; }

// Trilha única: as 10 unidades em sequência, cada uma aberta por uma faixa na sua cor
// e com as moedas da trilha na mesma cor. Ao abrir, rola até a lição atual.
function Journey() {
  const { progress, unit: course, profile } = useLearning();
  const currentLessonRef = useRef<View>(null);
  const reducedMotion = useMotionPreference();
  const [visit, setVisit] = useState(0);
  useFocusEffect(useCallback(() => { setVisit(value => value + 1); }, []));
  if (!progress) return null;
  const units = journeyUnits(course);
  const starts = units.map((_, index) => units.slice(0, index).reduce((sum, previous) => sum + previous.lessons.length, 0));
  return <Screen
    style={styles.content}
    resetScrollKey={`learn:${visit}`}
    initialScrollTarget={currentLessonRef}
    animateInitialScroll={!reducedMotion}
    header={<LearningMasthead appearance="trail" xp={progress.xp} streak={profile?.current_streak ?? 0} />}
  >
    {units.map((unit, index) => (
      <View key={unit.id} testID={`trail-section-${unit.id}`} style={styles.section}>
        <UnitBanner unit={unit} index={index} progress={progress} />
        <JourneyTrail lessons={unit.lessons} startIndex={starts[index]} color={unitTrailTheme(index).color} unitId={unit.id} currentLessonRef={currentLessonRef} />
      </View>
    ))}
  </Screen>;
}
const styles = StyleSheet.create({
  content: { paddingTop: 16, paddingBottom: 32, gap: 28 },
  section: { width: '100%', gap: 8 },
});
