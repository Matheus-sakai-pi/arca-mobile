import { Pressable, StyleSheet, View } from 'react-native';
import { CircleCheck, CircleX } from '@/components/icons';
import { AppText } from '@/components/common/AppText';
import { colors, radius, spacing } from '@/constants/theme';
import type { TrueFalseQuestion as Question } from '@/types/learning';
import { choiceTone, exerciseStyles, QuestionPrompt, toneColors } from './QuestionParts';
import type { ExerciseProps } from './types';

export function TrueFalseQuestion({ question, answer, verified, onAnswer }: ExerciseProps<Question>) {
  return (
    <View style={exerciseStyles.container}>
      <QuestionPrompt text={question.prompt} />
      <View accessibilityRole="radiogroup" accessibilityLabel="Verdadeiro ou falso" style={styles.row}>
        {question.options.map(option => {
          const tone = choiceTone(answer === option.id, question.correctAnswer === option.id, verified);
          const accent = option.id === 'true' ? colors.success : '#EE3949';
          const palette =
            tone === 'neutral'
              ? {
                  background: option.id === 'true' ? '#F0FCF4' : '#FFF1F2',
                  border: option.id === 'true' ? '#BDEBCB' : '#FFC9CE',
                  ink: accent,
                }
              : toneColors[tone];
          const Icon = option.id === 'true' ? CircleCheck : CircleX;
          return (
            <Pressable
              key={option.id}
              accessibilityRole="radio"
              accessibilityLabel={`${option.label}${tone === 'correct' ? ', resposta correta' : tone === 'wrong' ? ', resposta incorreta' : ''}`}
              accessibilityState={{ checked: answer === option.id, disabled: verified }}
              disabled={verified}
              onPress={() => onAnswer(option.id)}
              style={({ pressed }) => [
                styles.tile,
                { backgroundColor: palette.background, borderColor: palette.border },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Icon size={58} />
              <AppText
                variant="h3"
                color={tone === 'neutral' ? colors.text : palette.ink}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                style={styles.label}
              >
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
  row: { flexDirection: 'row', gap: spacing.sm },
  tile: {
    flex: 1,
    minHeight: 170,
    padding: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderBottomWidth: 5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  label: { textAlign: 'center', width: '100%' },
});
