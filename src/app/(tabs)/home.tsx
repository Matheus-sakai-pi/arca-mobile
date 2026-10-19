import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowRight, RotateCcw, Settings } from '@/components/icons';
import { Avatar } from '@/components/profile/Avatar';
import { ProfileSettings } from '@/components/profile/ProfileSettings';
import { LearningStats } from '@/components/learning/LearningStats';
import { journeyUnits } from '@/data/lessons';
import { Screen } from '@/components/common/Screen';
import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { IconButton } from '@/components/common/IconButton';
import { Mascot } from '@/components/mascot/Mascot';
import { LearningGate } from '@/components/learning/LearningGate';
import { LearningTrail } from '@/components/learning/LearningTrail';
import { StudySummary } from '@/components/learning/StudySummary';
import { EventProgressBar } from '@/components/animation/EventProgressBar';
import { useLearning } from '@/providers/LearningProvider';
import { nextLesson } from '@/lib/learningProgress';
import { unitAccent } from '@/lib/trailAppearance';
import { colors, spacing, surfaces } from '@/constants/theme';
import { redesignAssets } from '@/constants/redesignAssets';

export default function Home() { return <LearningGate><HomeContent /></LearningGate>; }
function HomeContent() {
  const { progress, startLesson, unit: initialUnit, profile } = useLearning();
  const [settings, setSettings] = useState(false);
  if (!progress) return null;
  const next = nextLesson(progress, initialUnit);
  const target = next ?? initialUnit.lessons[initialUnit.lessons.length - 1];
  const units = journeyUnits(initialUnit);
  const currentUnit = units.find(unit => unit.id === target?.unitId) ?? units[0]!;
  const unitIndex = units.findIndex(unit => unit.id === currentUnit.id);
  const accent = unitAccent(Math.max(0, unitIndex));
  const completed = currentUnit.lessons.filter(lesson => progress.completedLessonIds.includes(lesson.id)).length;
  return <Screen>
    <View style={styles.hero}>
      <View style={styles.header}><Image source={redesignAssets.logoWhite} style={styles.brand} resizeMode="contain" accessible accessibilityLabel="Arca" testID="home-brand-logo" />
        <View style={styles.tools}><Pressable accessibilityRole="button" accessibilityLabel="Abrir meu perfil" onPress={() => router.navigate('/(tabs)/profile')} style={styles.avatarRing}><Avatar avatarKey={profile?.avatar_key} size={48} /></Pressable><IconButton icon={Settings} label="Configurações" onPress={() => setSettings(true)} /></View>
      </View>
      <LearningStats motionKey="home" xp={progress.xp} streak={profile?.current_streak ?? 0} />
    </View>
    <View style={styles.feature}>
      <AppText variant="label" color={accent.ink}>{next ? `UNIDADE ${unitIndex + 1} · SUA JORNADA` : 'JORNADA CONCLUÍDA'}</AppText>
      <View style={styles.featureTop}><View style={styles.featureText}><AppText variant="h2" style={styles.featureHeading}>{next?.title ?? 'Muito bem!'}</AppText><AppText color={colors.muted}>{next ? `Lição ${currentUnit.lessons.findIndex(lesson => lesson.id === next.id) + 1} de ${currentUnit.lessons.length}` : `Todos os ${initialUnit.lessons.length} passos completos.`}</AppText><AppText variant="small" color={colors.muted}>{currentUnit.title}</AppText></View><View style={styles.art}><Mascot size={96} state={next ? 'reading' : 'lesson_complete'} /></View></View>
      <View style={styles.featureProgress}><EventProgressBar motionKey={`home:unit:${currentUnit.id}`} value={completed / currentUnit.lessons.length * 100} label="Progresso da unidade atual" color={accent.color} /><AppText color={colors.primaryDark}>{completed}/{currentUnit.lessons.length} lições concluídas</AppText></View>
      <Button title={next ? 'Continuar' : 'Revisar'} icon={next ? ArrowRight : RotateCcw} onPress={() => { if (target) { startLesson(target.id); router.push({ pathname: '/lesson/[id]', params: { id: target.id } }); } }} />
    </View>
    <StudySummary />
    <AppText variant="h3" accessibilityRole="header">Nesta unidade</AppText>
    <LearningTrail lessons={currentUnit.lessons} />
    {settings ? <ProfileSettings onClose={() => setSettings(false)} /> : null}
  </Screen>;
}
const styles = StyleSheet.create({
  hero: { gap: spacing.sm, paddingTop: spacing.xs },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  // O logo branco vira azul sobre o fundo branco.
  brand: { width: 132, height: 44, flexShrink: 0, tintColor: colors.primary },
  tools: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  avatarRing: { padding: 2, borderWidth: 2, borderColor: colors.border, borderRadius: 999, backgroundColor: colors.surface },
  feature: { ...surfaces.tactile, padding: spacing.md, gap: spacing.md },
  featureTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  featureText: { flex: 1, minWidth: 0, gap: spacing.xs },
  featureHeading: { fontSize: 22, lineHeight: 28 },
  art: { width: 96, height: 112, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  featureProgress: { gap: spacing.xs },
});
