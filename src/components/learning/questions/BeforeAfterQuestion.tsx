import { Pressable, StyleSheet, View } from 'react-native';
import { Flag } from 'lucide-react-native';
import { AppText } from '@/components/common/AppText';
import type { BeforeAfterQuestion as Data } from '@/types/learning';
import { spacing } from '@/constants/theme';
import { choiceTone, exerciseStyles, QuestionPrompt, toneColors } from './QuestionParts';
import type { ExerciseProps } from './types';

export function BeforeAfterQuestion({ question, answer, verified, onAnswer }: ExerciseProps<Data>) {
  return <View style={exerciseStyles.container}><QuestionPrompt text={question.prompt} /><View style={styles.events}>{question.options.map(option => {
    const tone = toneColors[choiceTone(answer === option.id, question.correctAnswer === option.id, verified)];
    return <Pressable key={option.id} accessibilityRole="radio" accessibilityLabel={option.label} accessibilityState={{ checked: answer === option.id, disabled: verified }} onPress={() => onAnswer(option.id)} disabled={verified} style={({ pressed }) => [styles.event, { backgroundColor: tone.background, borderColor: tone.border }, pressed && { opacity: 0.8 }]}><Flag color={tone.ink} size={24} /><AppText color={tone.ink} style={styles.text}>{option.label}</AppText></Pressable>;
  })}</View></View>;
}
const styles = StyleSheet.create({ events: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.sm }, event: { flex: 1, minWidth: 0, minHeight: 160, borderRadius: 8, borderWidth: 2, borderBottomWidth: 5, padding: spacing.sm, alignItems: 'center', justifyContent: 'center', gap: spacing.md }, text: { textAlign: 'center' } });
