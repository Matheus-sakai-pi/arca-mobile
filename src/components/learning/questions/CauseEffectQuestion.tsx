import { StyleSheet, View } from 'react-native';
import { ArrowDown, GitBranch } from 'lucide-react-native';
import { AppText } from '@/components/common/AppText';
import type { CauseEffectQuestion as Data } from '@/types/learning';
import { colors, spacing } from '@/constants/theme';
import { choiceTone, exerciseStyles, QuestionPrompt, WordChip } from './QuestionParts';
import type { ExerciseProps } from './types';

export function CauseEffectQuestion({ question, answer, verified, onAnswer }: ExerciseProps<Data>) {
  return (
    <View style={exerciseStyles.container}>
      <View style={styles.event}>
        <GitBranch size={24} color={colors.tealInk} />
        <AppText variant="h3" style={styles.text}>
          {question.event}
        </AppText>
      </View>
      <View style={styles.arrow}>
        <ArrowDown color={colors.tealInk} />
        <AppText variant="label" color={colors.tealInk}>
          {question.relation === 'effect' ? 'CONSEQUÊNCIA' : 'CAUSA'}
        </AppText>
      </View>
      <QuestionPrompt text={question.prompt} />
      <View style={styles.answers}>
        {question.options.map(option => (
          <WordChip
            key={option.id}
            label={option.label}
            radio
            checked={answer === option.id}
            disabled={verified}
            onPress={() => onAnswer(option.id)}
            tone={choiceTone(answer === option.id, question.correctAnswer === option.id, verified)}
          />
        ))}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  event: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderLeftWidth: 4,
    borderColor: colors.tealInk,
    backgroundColor: colors.surface,
  },
  text: { flex: 1 },
  arrow: { alignItems: 'center', gap: spacing.xs },
  answers: { gap: spacing.sm },
});
