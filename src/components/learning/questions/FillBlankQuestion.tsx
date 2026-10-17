import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/common/AppText';
import { colors, radius, spacing } from '@/constants/theme';
import type { FillBlankQuestion as Question } from '@/types/learning';
import { choiceTone, exerciseStyles, QuestionPrompt, toneColors, WordChip } from './QuestionParts';
import type { ExerciseProps } from './types';

export function FillBlankQuestion({ question, answer, verified, onAnswer }: ExerciseProps<Question>) {
  const selected = typeof answer === 'string' ? answer : null;
  const word = question.options.find(option => option.id === selected)?.label ?? '______';
  const [before, after] = question.sentence.split('{{blank}}');
  const palette = toneColors[choiceTone(selected !== null, selected === question.correctAnswer, verified)];
  return (
    <View style={exerciseStyles.container}>
      <QuestionPrompt text={question.prompt} />
      <View style={styles.sentence}>
        <AppText variant="h2" accessibilityLabel={`${before ?? ''}${word}${after ?? ''}`}>
          {before}
          <AppText variant="h2" color={palette.ink} style={{ backgroundColor: palette.background }}>
            {word}
          </AppText>
          {after}
        </AppText>
      </View>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Palavras para completar a frase"
        style={exerciseStyles.chips}
      >
        {question.options.map(option => (
          <WordChip
            key={option.id}
            label={option.label}
            radio
            checked={selected === option.id}
            tone={choiceTone(selected === option.id, option.id === question.correctAnswer, verified)}
            disabled={verified}
            onPress={() => onAnswer(option.id)}
          />
        ))}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  sentence: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    minHeight: 124,
    justifyContent: 'center',
  },
});
