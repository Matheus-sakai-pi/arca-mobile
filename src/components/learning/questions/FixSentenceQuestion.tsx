import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/common/AppText';
import type { FixSentenceQuestion as Data } from '@/types/learning';
import { isAnswerPairs } from '@/lib/questionEngine';
import { colors, spacing } from '@/constants/theme';
import { choiceTone, exerciseStyles, QuestionPrompt, WordChip } from './QuestionParts';
import type { ExerciseProps } from './types';

export function FixSentenceQuestion({ question, answer, verified, onAnswer }: ExerciseProps<Data>) {
  const selected = isAnswerPairs(answer) ? answer : {};
  return (
    <View style={exerciseStyles.container}>
      <QuestionPrompt text={question.prompt} />
      <View style={styles.sentence}>
        {question.fragments.map(part => {
          const replaced = selected.fragment === part.id && selected.replacement;
          const label = replaced
            ? (question.options.find(option => option.id === selected.replacement)?.label ?? part.label)
            : part.label;
          return (
            <WordChip
              key={part.id}
              label={label}
              checked={selected.fragment === part.id}
              disabled={verified}
              tone={choiceTone(
                selected.fragment === part.id,
                question.correctAnswer.fragment === part.id,
                verified,
              )}
              onPress={() => onAnswer({ fragment: part.id })}
            />
          );
        })}
      </View>
      {selected.fragment || verified ? (
        <View style={styles.replacements}>
          <AppText variant="label" color={colors.muted}>
            SUBSTITUIR POR
          </AppText>
          <View style={exerciseStyles.chips}>
            {question.options.map(option => (
              <WordChip
                key={option.id}
                label={option.label}
                radio
                checked={selected.replacement === option.id}
                disabled={verified}
                tone={choiceTone(
                  selected.replacement === option.id,
                  question.correctAnswer.replacement === option.id,
                  verified,
                )}
                onPress={() => onAnswer({ ...selected, replacement: option.id })}
              />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  sentence: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  replacements: { gap: spacing.sm },
});
