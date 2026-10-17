import { Pressable, StyleSheet, View } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { AppText } from '@/components/common/AppText';
import { colors, radius, spacing } from '@/constants/theme';
import { Mascot } from '@/components/mascot/Mascot';

export function QuestionPrompt({ text }: { text: string }) {
  return (
    <View style={styles.prompt}>
      <AppText variant="h2" accessibilityRole="header" style={styles.promptText}>
        {text}
      </AppText>
      <View style={styles.mascot}>
        <Mascot state="thinking" size={80} decorative />
      </View>
    </View>
  );
}
export type Tone = 'neutral' | 'selected' | 'correct' | 'wrong';
export const toneColors = {
  neutral: { background: colors.surface, border: colors.border, ink: colors.text },
  selected: { background: colors.primarySoft, border: colors.primary, ink: colors.primaryDark },
  correct: { background: colors.successSoft, border: colors.success, ink: colors.success },
  wrong: { background: colors.errorSoft, border: colors.error, ink: colors.error },
} as const;
export function choiceTone(chosen: boolean, correct: boolean, verified: boolean): Tone {
  return verified && correct ? 'correct' : verified && chosen ? 'wrong' : chosen ? 'selected' : 'neutral';
}
export function WordChip({
  label,
  tone = 'neutral',
  disabled,
  onPress,
  radio = false,
  checked = false,
}: {
  label: string;
  tone?: Tone;
  disabled: boolean;
  onPress: () => void;
  radio?: boolean;
  checked?: boolean;
}) {
  const palette = toneColors[tone];
  const suffix = tone === 'correct' ? ', resposta correta' : tone === 'wrong' ? ', resposta incorreta' : '';
  return (
    <Pressable
      accessibilityRole={radio ? 'radio' : 'button'}
      accessibilityLabel={`${label}${suffix}`}
      accessibilityState={{ disabled, ...(radio ? { checked } : {}) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: palette.background, borderColor: palette.border },
        pressed && { opacity: 0.7 },
      ]}
    >
      <AppText style={styles.chipText} color={palette.ink}>
        {label}
      </AppText>
      {tone === 'correct' ? (
        <Check size={18} color={palette.ink} />
      ) : tone === 'wrong' ? (
        <X size={18} color={palette.ink} />
      ) : null}
    </Pressable>
  );
}
export const exerciseStyles = StyleSheet.create({
  container: { gap: spacing.lg, width: '100%' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  surface: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
});
const styles = StyleSheet.create({
  prompt: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 96 },
  promptText: { flex: 1, minWidth: 0, fontSize: 23, lineHeight: 30 },
  mascot: { width: 80, height: 96, justifyContent: 'center', flexShrink: 0 },
  chip: {
    minHeight: 48,
    maxWidth: '100%',
    borderWidth: 2,
    borderBottomWidth: 4,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  chipText: { flexShrink: 1, textAlign: 'center' },
});
