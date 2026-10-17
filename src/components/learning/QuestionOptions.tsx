import { Pressable, StyleSheet, View } from 'react-native';
import { Check, Circle, X } from 'lucide-react-native';
import { AppText } from '@/components/common/AppText';
import { colors, fonts, radius, spacing } from '@/constants/theme';
import type { SingleAnswerQuestion } from '@/types/learning';
import { tactile } from './questions/QuestionParts';

type Props = {
  question: SingleAnswerQuestion;
  selected: string | null;
  verified: boolean;
  onSelect: (id: string) => void;
};
export function QuestionOptions({ question, selected, verified, onSelect }: Props) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Alternativas" style={styles.options}>
      {question.options.map((option, index) => {
        const chosen = selected === option.id;
        const correct = verified && option.id === question.correctAnswer;
        const wrong = verified && chosen && !correct;
        const highlighted = chosen && !verified;
        const ink = correct ? colors.success : wrong ? colors.error : highlighted ? colors.surface : colors.muted;
        const Icon = correct ? Check : wrong ? X : chosen ? Check : Circle;
        const suffix = correct ? ', resposta correta' : wrong ? ', resposta incorreta' : '';
        return (
          <Pressable
            key={option.id}
            accessibilityRole="radio"
            accessibilityLabel={`${option.label}${suffix}`}
            accessibilityState={{ checked: chosen, disabled: verified }}
            aria-checked={chosen}
            disabled={verified}
            onPress={() => onSelect(option.id)}
            style={({ pressed }) => [
              styles.option,
              tactile.base,
              highlighted && styles.selected,
              correct && styles.correct,
              wrong && styles.wrong,
              pressed && !verified && tactile.pressed,
            ]}
          >
            <View style={[styles.number, highlighted && styles.selectedNumber]}>
              <AppText variant="label" color={highlighted ? colors.primaryDark : colors.muted}>
                {index + 1}
              </AppText>
            </View>
            <AppText style={styles.label} color={highlighted ? colors.surface : undefined}>
              {option.label}
            </AppText>
            <Icon size={22} color={ink} />
          </Pressable>
        );
      })}
    </View>
  );
}
const styles = StyleSheet.create({
  options: { gap: 10 },
  option: {
    minHeight: 64,
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  selected: { backgroundColor: colors.primary, borderColor: colors.primaryDark },
  correct: { backgroundColor: colors.successSoft, borderColor: colors.success },
  wrong: { backgroundColor: colors.errorSoft, borderColor: colors.error },
  number: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: colors.background,
  },
  selectedNumber: { backgroundColor: colors.surface },
  label: { flex: 1, minWidth: 0, fontFamily: fonts.medium, fontSize: 17, lineHeight: 24 },
});
