import { useCallback } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { Screen } from '@/components/common/Screen';
import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Mascot } from '@/components/mascot/Mascot';
import { LearningGate } from '@/components/learning/LearningGate';
import { useLearning } from '@/providers/LearningProvider';
import { returnToTrail } from '@/lib/learningNavigation';
import { colors, spacing } from '@/constants/theme';
import { ResultCounters } from '@/components/learning/ResultCounters';
import { ReminderPrompt } from '@/components/learning/ReminderPrompt';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { useMotionPreference } from '@/hooks/useMotionPreference';
import { resultMotion } from '@/constants/motion';
import { journeyUnits } from '@/data/lessons';
import { EventProgressBar } from '@/components/animation/EventProgressBar';
import { VisualBurst } from '@/components/animation/VisualBurst';

export default function ResultScreen() {
  useFocusEffect(useCallback(() => { const listener = BackHandler.addEventListener('hardwareBackPress', () => { returnToTrail(); return true; }); return () => listener.remove(); }, []));
  return <LearningGate><ResultContent /></LearningGate>;
}
function ResultContent() {
  const { progress, unit } = useLearning();
  const reduced = useMotionPreference();
  const result = progress?.lastResult;
  if (!result) return <Screen><AppText variant="h2">Sua próxima conquista está na trilha.</AppText><Button title="Voltar à trilha" onPress={returnToTrail} /></Screen>;
  const currentUnit = journeyUnits(unit).find(item => item.lessons.some(lesson => lesson.id === result.lessonId));
  const completed = currentUnit?.lessons.filter(lesson => progress?.completedLessonIds.includes(lesson.id)).length ?? 0;
  return <Screen style={styles.content} footer={<Button title="Continuar" icon={ArrowRight} onPress={returnToTrail} />}>
    <Animated.View entering={FadeInDown.duration(resultMotion.duration).reduceMotion(reduced ? ReduceMotion.Always : ReduceMotion.System)} style={styles.heading}>
    <VisualBurst event={`lesson:${result.attemptId}`} enabled={result.xpEarned > 0} />
    <Mascot state="lesson_complete" size={112} animated motionKey={result.attemptId} />
    <AppText variant="h1" style={styles.center} accessibilityRole="header">Lição concluída!</AppText>
    <AppText color={colors.muted} style={styles.center}>{unit.lessons.find(lesson=>lesson.id === result.lessonId)?.title ?? unit.title}</AppText>
    </Animated.View>
    <ResultCounters result={result} />
    <Animated.View testID="result-details" entering={FadeInDown.delay(resultMotion.progress).duration(resultMotion.duration).reduceMotion(reduced ? ReduceMotion.Always : ReduceMotion.System)} style={styles.details}>
    <AppText variant="small" color={colors.muted} style={styles.center}>{result.xpEarned === 0 ? 'Revisão concluída. O XP desta lição já foi recebido.' : result.accuracy === 100 ? 'Todas corretas! Você ganhou +5 XP de bônus.' : 'Mais um passo na sua jornada.'}</AppText>
    <AppText variant="small" color={colors.primaryDark} style={styles.center}>{progress?.xp ?? 0} XP no total</AppText>
    {result.vipBonus ? <AppText variant="label" color={colors.primaryDark} style={styles.center}>Inclui +{result.vipBonus} XP do Arca VIP</AppText> : null}
    {currentUnit ? <View style={styles.unitProgress}><View style={styles.progressHeading}><AppText variant="label" color={colors.muted} style={styles.unitTitle}>{currentUnit.title}</AppText><AppText variant="label" style={styles.count}>{completed}/{currentUnit.lessons.length}</AppText></View><EventProgressBar value={completed/currentUnit.lessons.length*100} label="Progresso da unidade concluída" motionKey={`result:unit:${currentUnit.id}`} /></View> : null}
    </Animated.View>
    <ReminderPrompt completed={progress?.completedLessonIds??[]} />
  </Screen>;
}
const styles = StyleSheet.create({ content: { justifyContent: 'center', gap: spacing.md, paddingVertical: spacing.md }, heading: { gap: spacing.xs }, center: { textAlign: 'center' }, details: { gap: spacing.xs }, unitProgress: { gap: spacing.xs, marginTop: spacing.sm }, progressHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, unitTitle: { flex: 1 }, count: { fontVariant: ['tabular-nums'] } });
