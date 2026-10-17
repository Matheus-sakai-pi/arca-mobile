import { StyleSheet, View } from 'react-native';
import { ArrowRight } from 'lucide-react-native';
import { AppText } from '@/components/common/AppText';
import type { SequenceQuestion as Data } from '@/types/learning';
import { colors, spacing } from '@/constants/theme';
import { choiceTone, exerciseStyles, QuestionPrompt, WordChip } from './QuestionParts';
import type { ExerciseProps } from './types';

export function SequenceQuestion({ question, answer, verified, onAnswer }: ExerciseProps<Data>) {
  const chosen = question.options.find(option => option.id === (verified ? question.correctAnswer : answer));
  return (
    <View style={exerciseStyles.container}>
      <QuestionPrompt text={question.prompt} />
      <View style={styles.sequence}>
        {question.sequence.map((item, index) => (
          <View key={index} style={styles.step}>
            <View style={[styles.token, item === null && styles.blank]}>
              <AppText color={item === null ? colors.primaryDark : colors.text} style={styles.text}>
                {item ?? chosen?.label ?? '?'}
              </AppText>
            </View>
            {index < question.sequence.length - 1 ? <ArrowRight size={18} color={colors.muted} /> : null}
          </View>
        ))}
      </View>
      <View style={exerciseStyles.chips}>
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
  sequence: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, alignItems: 'center' },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, maxWidth: '100%' },
  token: {
    minHeight: 54,
    maxWidth: '88%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.sm,
    justifyContent: 'center',
  },
  blank: { borderStyle: 'dashed', borderColor: colors.primary, backgroundColor: colors.primarySoft },
  text: { textAlign: 'center', flexShrink: 1 },
});
