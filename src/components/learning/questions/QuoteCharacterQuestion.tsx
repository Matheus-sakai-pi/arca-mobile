import { StyleSheet, View } from 'react-native';
import { Quote, UserRound } from 'lucide-react-native';
import { AppText } from '@/components/common/AppText';
import type { QuoteCharacterQuestion as Data } from '@/types/learning';
import { colors, spacing } from '@/constants/theme';
import { choiceTone, exerciseStyles, QuestionPrompt, WordChip } from './QuestionParts';
import type { ExerciseProps } from './types';

export function QuoteCharacterQuestion({ question, answer, verified, onAnswer }: ExerciseProps<Data>) {
  return (
    <View style={exerciseStyles.container}>
      <View style={styles.quote}>
        <Quote size={28} color={colors.primary} />
        <AppText variant="h2">{question.quote}</AppText>
        <AppText variant="small" color={colors.muted}>
          {question.source}
        </AppText>
      </View>
      <QuestionPrompt text={question.prompt} />
      <View style={styles.people}>
        {question.options.map(option => (
          <View key={option.id} style={styles.person}>
            <UserRound size={22} color={colors.muted} />
            <WordChip
              label={option.label}
              radio
              checked={answer === option.id}
              disabled={verified}
              onPress={() => onAnswer(option.id)}
              tone={choiceTone(answer === option.id, question.correctAnswer === option.id, verified)}
            />
          </View>
        ))}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  quote: {
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderLeftWidth: 4,
    borderColor: colors.primary,
  },
  people: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  person: { alignItems: 'center', gap: spacing.xs, maxWidth: '100%' },
});
