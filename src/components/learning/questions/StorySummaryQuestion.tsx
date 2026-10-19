import { Pressable, StyleSheet, View } from 'react-native';
import { BookOpen } from '@/components/icons';
import { AppText } from '@/components/common/AppText';
import type { StorySummaryQuestion as Data } from '@/types/learning';
import { spacing } from '@/constants/theme';
import { choiceTone, exerciseStyles, QuestionPrompt, toneColors } from './QuestionParts';
import type { ExerciseProps } from './types';

export function StorySummaryQuestion({ question, answer, verified, onAnswer }: ExerciseProps<Data>) {
  return (
    <View style={exerciseStyles.container}>
      <QuestionPrompt text={question.prompt} />
      <View style={styles.summaries}>
        {question.options.map((option, index) => {
          const palette =
            toneColors[choiceTone(answer === option.id, question.correctAnswer === option.id, verified)];
          return (
            <Pressable
              key={option.id}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ checked: answer === option.id, disabled: verified }}
              disabled={verified}
              onPress={() => onAnswer(option.id)}
              style={({ pressed }) => [
                styles.summary,
                { backgroundColor: palette.background, borderColor: palette.border },
                pressed && { opacity: 0.8 },
              ]}
            >
              <View style={styles.label}>
                <BookOpen size={18} color={palette.ink} />
                <AppText variant="label" color={palette.ink}>
                  RESUMO {index + 1}
                </AppText>
              </View>
              <AppText color={palette.ink}>{option.label}</AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  summaries: { gap: spacing.sm },
  summary: { padding: spacing.md, gap: spacing.xs, borderRadius: 8, borderWidth: 2, borderBottomWidth: 4 },
  label: { flexDirection: 'row', gap: spacing.xs, alignItems: 'center' },
});
