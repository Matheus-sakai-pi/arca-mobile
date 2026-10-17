import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/common/AppText';
import type { OddOneOutQuestion as Data } from '@/types/learning';
import { spacing } from '@/constants/theme';
import { choiceTone, exerciseStyles, QuestionPrompt, toneColors } from './QuestionParts';
import type { ExerciseProps } from './types';

export function OddOneOutQuestion({ question, answer, verified, onAnswer }: ExerciseProps<Data>) {
  return (
    <View style={exerciseStyles.container}>
      <QuestionPrompt text={question.prompt} />
      <View style={styles.grid}>
        {question.options.map(option => {
          const tone =
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
                styles.tile,
                { backgroundColor: tone.background, borderColor: tone.border },
                pressed && { transform: [{ scale: 0.97 }] },
              ]}
            >
              <AppText variant="h3" color={tone.ink} style={styles.text}>
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    width: '47%',
    flexGrow: 1,
    minHeight: 98,
    borderRadius: 8,
    borderWidth: 2,
    borderBottomWidth: 5,
    padding: spacing.sm,
    justifyContent: 'center',
  },
  text: { textAlign: 'center' },
});
