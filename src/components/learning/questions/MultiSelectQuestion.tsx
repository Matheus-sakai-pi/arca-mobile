import { Pressable, StyleSheet, View } from 'react-native';
import { Check, Square, SquareCheck, X } from 'lucide-react-native';
import { AppText } from '@/components/common/AppText';
import { colors, radius, spacing } from '@/constants/theme';
import { isAnswerList } from '@/lib/questionEngine';
import type { MultiSelectQuestion as Question } from '@/types/learning';
import { choiceTone, exerciseStyles, QuestionPrompt, toneColors } from './QuestionParts';
import type { ExerciseProps } from './types';

export function MultiSelectQuestion({ question, answer, verified, onAnswer }: ExerciseProps<Question>) {
  const selected = isAnswerList(answer) ? answer : [];
  return <View style={exerciseStyles.container}><QuestionPrompt text={question.prompt} /><View accessibilityLabel="Seleção de respostas" style={styles.options}>{question.options.map(option => {
    const chosen = selected.includes(option.id);
    const expected = question.correctAnswer.includes(option.id);
    const tone = choiceTone(chosen, expected, verified);
    const palette = toneColors[tone];
    const Icon = verified && tone === 'correct' ? Check : verified && tone === 'wrong' ? X : chosen ? SquareCheck : Square;
    return <Pressable key={option.id} accessibilityRole="checkbox" accessibilityLabel={`${option.label}${verified && expected ? ', resposta correta' : verified && chosen ? ', resposta incorreta' : ''}`} accessibilityState={{ checked: chosen, disabled: verified }} aria-checked={chosen} disabled={verified} onPress={() => onAnswer(chosen ? selected.filter(id => id !== option.id) : [...selected, option.id])} style={({ pressed }) => [styles.option, { backgroundColor: palette.background, borderColor: palette.border }, pressed && { opacity: 0.7 }]}><Icon size={24} color={palette.ink} /><AppText style={styles.label} color={palette.ink}>{option.label}</AppText></Pressable>;
  })}</View><AppText variant="small" color={colors.muted}>{selected.length} {selected.length === 1 ? 'selecionada' : 'selecionadas'}</AppText></View>;
}
const styles = StyleSheet.create({ options: { gap: spacing.sm }, option: { minHeight: 60, borderRadius: radius.sm, borderWidth: 2, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md }, label: { flex: 1 } });
