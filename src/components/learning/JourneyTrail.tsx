import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { AppText } from '@/components/common/AppText';
import { lessonStatus } from '@/lib/learningProgress';
import { JOURNEY_CONNECTOR_HEIGHT, journeyConnector, journeyGeometry } from '@/lib/journeyLayout';
import { savedLessonPercent } from '@/lib/trailAppearance';
import { useLearning } from '@/providers/LearningProvider';
import { useStudy } from '@/providers/StudyProvider';
import { colors, fonts } from '@/constants/theme';
import { CHEST_ENERGY_CONFIG } from '@/config/energy';
import type { Lesson } from '@/types/learning';
import { JourneyNode } from './JourneyNode';
import { TrailMilestone } from './TrailMilestone';
import { EnergyChest } from './EnergyChest';

export function JourneyTrail({ lessons, startIndex = 0, color = '#0964FF', unitId }: { lessons: readonly Lesson[]; startIndex?: number; color?: string; unitId: string }) {
  const { progress, activeLessonId, startLesson, unit: course } = useLearning();
  const { state } = useStudy();
  const [width, setWidth] = useState(0);
  const [blockedId, setBlockedId] = useState<string | null>(null);
  if (!progress) return null;
  const completed = lessons.filter(lesson => progress.completedLessonIds.includes(lesson.id)).length;
  const halfway = Math.ceil(lessons.length * CHEST_ENERGY_CONFIG.completedFraction);
  return <View testID={`unit-trail-${unitId}`} style={styles.journey} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    {lessons.map((lesson, index) => {
      const globalIndex = startIndex + index;
      const status = lessonStatus(progress, lesson.id, activeLessonId, course);
      const geometry = width > 0 ? journeyGeometry(width, globalIndex) : null;
      const centerX = geometry?.centerX ?? width / 2;
      const clusterWidth = geometry?.clusterWidth ?? 144;
      return <View key={lesson.id}>
        <View style={[styles.step, { paddingTop: status === 'current' || status === 'available' ? 38 : 4 }]}>
          <View style={[styles.cluster, { width: clusterWidth, marginLeft: Math.max(0, centerX - clusterWidth / 2) }]}>
            <JourneyNode lessonId={lesson.id} title={lesson.title} status={status} color={color} percent={savedLessonPercent(lesson, state?.drafts[lesson.id])} onPress={() => {
              if (status === 'locked') { setBlockedId(lesson.id); return; }
              setBlockedId(null); startLesson(lesson.id);
              router.push({ pathname: '/lesson/[id]', params: { id: lesson.id } });
            }} />
            <AppText variant="small" style={styles.title} color={status === 'locked' ? colors.muted : colors.text}>{lesson.title}</AppText>
          </View>
          {blockedId === lesson.id ? <AppText accessibilityLiveRegion="polite" variant="small" style={styles.hint} color={colors.muted}>Conclua {course.lessons[globalIndex - 1]?.title ?? 'a lição anterior'} para liberar.</AppText> : null}
        </View>
        {index === halfway - 1 ? <EnergyChest unitId={unitId} completed={completed} total={lessons.length} /> : null}
        {index < lessons.length - 1 ? <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.connector}>{width > 0 ? <Svg width={width} height={JOURNEY_CONNECTOR_HEIGHT} viewBox={`0 0 ${width} ${JOURNEY_CONNECTOR_HEIGHT}`}><Path d={journeyConnector(width, globalIndex)} stroke={status === 'completed' ? color : '#DFE4EB'} strokeWidth={4} strokeDasharray="2 10" strokeLinecap="round" fill="none" /></Svg> : null}</View> : null}
      </View>;
    })}
    <TrailMilestone unitId={unitId} kind="trophy" reached={completed === lessons.length} completed={completed} total={lessons.length} />
  </View>;
}
const styles = StyleSheet.create({
  journey: { width: '100%', paddingTop: 12, paddingBottom: 4 },
  step: { width: '100%' },
  cluster: { width: 168, alignItems: 'center', gap: 2 },
  title: { width: '100%', minHeight: 36, textAlign: 'center', fontFamily: fonts.bold, fontSize: 13, lineHeight: 18 },
  hint: { textAlign: 'center', paddingHorizontal: 12, paddingVertical: 8 },
  connector: { width: '100%', height: JOURNEY_CONNECTOR_HEIGHT },
});
