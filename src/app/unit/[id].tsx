import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, BookOpen } from 'lucide-react-native';
import { Screen } from '@/components/common/Screen';
import { AppText } from '@/components/common/AppText';
import { IconButton } from '@/components/common/IconButton';
import { TrailNavigation } from '@/components/common/TrailNavigation';
import { LearningGate } from '@/components/learning/LearningGate';
import { LearningMasthead } from '@/components/learning/LearningMasthead';
import { JourneyTrail } from '@/components/learning/JourneyTrail';
import { journeyUnits } from '@/data/lessons';
import { unitTrailTheme } from '@/lib/trailAppearance';
import { useLearning } from '@/providers/LearningProvider';

export default function UnitJourney() { return <LearningGate><JourneyContent /></LearningGate>; }
function JourneyContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { progress, unit: course, profile } = useLearning();
  const units = journeyUnits(course);
  const index = units.findIndex(unit => unit.id === id);
  const unit = units[index];
  const back = () => router.canGoBack() ? router.back() : router.replace('/(tabs)/learn');
  if (!progress) return null;
  if (!unit) return <Screen><IconButton icon={ArrowLeft} label="Voltar às unidades" onPress={back} /><AppText variant="h2">Unidade não encontrada</AppText></Screen>;
  const theme = unitTrailTheme(index);
  const startIndex = units.slice(0, index).reduce((sum, previous) => sum + previous.lessons.length, 0);
  const completed = unit.lessons.filter(lesson => progress.completedLessonIds.includes(lesson.id)).length;
  return <View testID="clean-unit-screen" style={styles.screen}>
    <Screen backgroundColor="#FFFFFF" style={styles.content} resetScrollKey={id} header={<LearningMasthead appearance="trail" xp={progress.xp} streak={profile?.current_streak ?? 0} leading={<IconButton icon={ArrowLeft} label="Voltar às unidades" onPress={back} />} />}>
      <View key={unit.id} testID={`trail-section-${unit.id}`} style={styles.section}>
          <View testID={`unit-banner-${unit.id}`} style={[styles.banner, { backgroundColor: theme.color, borderBottomColor: theme.side }]}>
            <View style={styles.heading}><AppText variant="label" color={theme.ink}>UNIDADE {index + 1}</AppText><AppText variant="h3" color={theme.ink} accessibilityRole="header">{unit.title}</AppText><AppText variant="small" color={theme.ink}>{completed} de {unit.lessons.length} lições concluídas</AppText></View>
            <BookOpen size={32} color={theme.ink} strokeWidth={2.2} />
          </View>
          <JourneyTrail lessons={unit.lessons} startIndex={startIndex} color={theme.color} unitId={unit.id} />
      </View>
    </Screen>
    <TrailNavigation />
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { paddingTop: 16, paddingBottom: 24, gap: 16 },
  section: { width: '100%' },
  banner: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 8, borderBottomWidth: 5 },
  heading: { flex: 1, minWidth: 0, gap: 3 },
});
