import { Image, Pressable, StyleSheet, View } from 'react-native';
import { BookOpen, UsersRound, ScrollText, Crown, Fish, Sprout, Mail, ChevronRight, LockKeyhole } from 'lucide-react-native';
import { AppText } from '@/components/common/AppText';
import { EventProgressBar } from '@/components/animation/EventProgressBar';
import { artworkForUnit } from '@/constants/unitArtwork';
import { colors, fonts } from '@/constants/theme';
import { lessonStatus } from '@/lib/learningProgress';
import type { LearningProgress, Unit } from '@/types/learning';

const icons = { book: BookOpen, people: UsersRound, scroll: ScrollText, crown: Crown, fish: Fish, sprout: Sprout, mail: Mail };
const unitAccents = [
  { ink: colors.primaryDark, soft: colors.primarySoft },
  { ink: colors.tealInk, soft: colors.tealSoft },
  { ink: '#526B2D', soft: '#EDF4DF' },
  { ink: '#7951A8', soft: '#F1EAF9' },
  { ink: colors.goldInk, soft: colors.goldSoft },
] as const;

export function UnitCard({ unit, index, course, progress, onPress }: { unit: Unit; index: number; course: Unit; progress: LearningProgress; onPress: () => void }) {
  const art = artworkForUnit(unit.id);
  const Icon = icons[art.icon];
  const completed = unit.lessons.filter(lesson => progress.completedLessonIds.includes(lesson.id)).length;
  const percent = unit.lessons.length ? Math.round(completed / unit.lessons.length * 100) : 0;
  const locked = unit.lessons.every(lesson => lessonStatus(progress, lesson.id, null, course) === 'locked');
  const exercises = unit.lessons.reduce((sum, lesson) => sum + lesson.questions.filter(question => question.type !== 'content_card').length, 0);
  const accent = unitAccents[index % unitAccents.length]!;
  return <Pressable testID={`unit-card-${unit.id}`} accessibilityRole="button" accessibilityLabel={`Abrir unidade ${index + 1}: ${unit.title}, ${completed} de ${unit.lessons.length} lições concluídas${locked ? ', bloqueada' : ''}`} onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
    <View style={styles.labelRow}>
      <View style={[styles.icon, { backgroundColor: accent.soft }]}><Icon size={20} color={accent.ink} /></View>
      <AppText variant="label" color={accent.ink} style={styles.label}>UNIDADE {index + 1}</AppText>
      <AppText variant="label" color={colors.muted} style={styles.count}>{completed}/{unit.lessons.length}</AppText>
      <ChevronRight size={18} color={colors.muted} />
    </View>
    <View style={styles.subject}>
      <AppText accessibilityRole="header" style={styles.title}>{unit.title}</AppText>
      <Image testID={`unit-art-${unit.id}`} source={art.image} accessible={false} resizeMode="contain" style={styles.art} />
    </View>
    <AppText variant="small" color={colors.muted}>{exercises} exercícios · {art.caption}</AppText>
    <View style={styles.progressRow}>
      <View style={styles.bar}><EventProgressBar value={percent} label={`Progresso da unidade ${index + 1}`} motionKey={`learn:unit:${unit.id}`} /></View>
      <AppText variant="small" style={styles.percent}>{percent}%</AppText>
      {locked ? <LockKeyhole size={14} color={colors.muted} accessibilityLabel="Unidade bloqueada" /> : null}
    </View>
  </Pressable>;
}
const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, gap: 10, borderWidth: 1, borderColor: colors.border },
  pressed: { backgroundColor: '#F9FBFF', borderColor: colors.primary },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { flex: 1, fontSize: 13 },
  icon: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  count: { fontVariant: ['tabular-nums'] },
  subject: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 96 },
  title: { flex: 1, minWidth: 0, fontFamily: fonts.heavy, fontSize: 22, lineHeight: 28 },
  art: { width: 84, height: 96, flexShrink: 0 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bar: { flex: 1 },
  percent: { width: 40, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
