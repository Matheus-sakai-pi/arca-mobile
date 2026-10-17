import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { AppText } from '@/components/common/AppText';
import type { ClassifyQuestion as Data } from '@/types/learning';
import { isAnswerPairs } from '@/lib/questionEngine';
import { colors, spacing } from '@/constants/theme';
import { exerciseStyles, QuestionPrompt, WordChip } from './QuestionParts';
import type { ExerciseProps } from './types';

export function ClassifyQuestion({ question, answer, verified, onAnswer }: ExerciseProps<Data>) {
  const [active, setActive] = useState<string | null>(null);
  const assignments = isAnswerPairs(answer) ? answer : {};
  return <View style={exerciseStyles.container}><QuestionPrompt text={question.prompt} /><View style={exerciseStyles.chips}>{question.options.filter(option => !assignments[option.id]).map(option => <WordChip key={option.id} label={option.label} tone={active === option.id ? 'selected' : 'neutral'} disabled={verified} onPress={() => setActive(option.id)} />)}</View><View style={styles.categories}>{question.categories.map(category => <View key={category.id} style={[styles.category,active && styles.ready]}><Pressable accessibilityRole="button" accessibilityLabel={`Classificar em ${category.label}`} accessibilityState={{ disabled: verified || !active }} disabled={verified || !active} onPress={() => { if (active) onAnswer({ ...assignments, [active]: category.id }); setActive(null); }} style={({ pressed }) => [styles.target,pressed && { opacity: 0.8 }]}><AppText variant="label" color={colors.primaryDark} style={styles.center}>{category.label}</AppText></Pressable>{question.options.filter(option => assignments[option.id] === category.id).map(option => {
    const correct = question.correctAnswer[option.id] === category.id;
    return <View key={option.id} style={styles.placed}><WordChip label={option.label} disabled={verified} tone={verified ? correct ? 'correct' : 'wrong' : active === option.id ? 'selected' : 'neutral'} onPress={() => setActive(option.id)} />{verified ? correct ? <Check size={16} color={colors.success} /> : <X size={16} color={colors.error} /> : null}</View>;
  })}</View>)}</View></View>;
}
const styles = StyleSheet.create({ categories: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.sm }, category: { flex: 1, minWidth: 0, minHeight: 190, backgroundColor: colors.primarySoft, borderWidth: 2, borderColor: colors.border, borderRadius: 8, padding: spacing.xs, gap: spacing.sm }, target:{minHeight:72,justifyContent:'center'},ready: { borderColor: colors.primary, borderStyle: 'dashed' }, center: { textAlign: 'center', paddingVertical: spacing.sm }, placed: { gap: spacing.xxs, alignItems: 'center' } });
