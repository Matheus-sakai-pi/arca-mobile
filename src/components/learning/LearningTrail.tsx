import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { BookOpen, Check, ChevronRight, LockKeyhole, Play, Star } from 'lucide-react-native';
import { AppText } from '@/components/common/AppText';
import { lessonStatus } from '@/lib/learningProgress';
import { useLearning } from '@/providers/LearningProvider';
import { colors, radius, spacing } from '@/constants/theme';
import type { Lesson, LessonStatus } from '@/types/learning';

const labels: Record<LessonStatus, string> = {
  locked: 'Bloqueada',
  available: 'Disponível',
  current: 'Atual',
  completed: 'Concluída',
};
export function LearningTrail({ lessons }: { lessons?: readonly Lesson[] }) {
  const { progress, activeLessonId, startLesson, unit: initialUnit } = useLearning();
  if (!progress) return null;
  const items = lessons ?? initialUnit.lessons;
  return (
    <View>
      {items.map((lesson, index) => {
        const status = lessonStatus(progress, lesson.id, activeLessonId, initialUnit);
        const locked = status === 'locked';
        const completed = status === 'completed';
        const current = status === 'current';
        const Icon = locked
          ? LockKeyhole
          : completed
            ? Check
            : current
              ? Play
              : index === 4
                ? Star
                : BookOpen;
        return (
          <View key={lesson.id} style={styles.step}>
            {index < items.length - 1 ? (
              <View style={[styles.connector, completed && styles.completedConnector]} />
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${lesson.title}, ${labels[status]}`}
              accessibilityHint={locked ? 'Conclua a lição anterior para liberar.' : 'Abrir lição'}
              accessibilityState={{ disabled: locked }}
              disabled={locked}
              onPress={() => {
                startLesson(lesson.id);
                router.push({ pathname: '/lesson/[id]', params: { id: lesson.id } });
              }}
              style={({ pressed }) => [styles.row, current && styles.current, pressed && { opacity: 0.7 }]}
            >
              <View style={[styles.node, locked && styles.lockedNode, completed && styles.completedNode]}>
                <Icon size={24} color={locked ? colors.muted : completed ? colors.success : colors.surface} />
              </View>
              <View style={styles.text}>
                <AppText variant="h3" color={locked ? colors.muted : colors.text}>
                  {lesson.title}
                </AppText>
                <AppText variant="small" color={current ? colors.primaryDark : colors.muted}>
                  {labels[status]} · {lesson.questions.length} perguntas
                </AppText>
              </View>
              {!locked ? (
                <ChevronRight size={18} color={completed ? colors.success : colors.primary} />
              ) : null}
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}
const styles = StyleSheet.create({
  step: { position: 'relative', minHeight: 96, marginBottom: 12 },
  connector: { display: 'none' },
  completedConnector: { backgroundColor: colors.success },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    padding: spacing.md,
    minHeight: 88,
    borderRadius: 24,
    backgroundColor: colors.surface,
    boxShadow: '0 4px 14px rgba(71,121,218,0.08)',
  },
  current: { backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.primary },
  node: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedNode: { backgroundColor: colors.track },
  completedNode: { backgroundColor: colors.successSoft, borderWidth: 2, borderColor: colors.success },
  text: { flex: 1, gap: spacing.xxs },
});
