import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Lightbulb } from 'lucide-react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { useMotionPreference } from '@/hooks/useMotionPreference';
import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { colors, radius, spacing } from '@/constants/theme';
import type { WhoAmIQuestion as Question } from '@/types/learning';
import { QuestionOptions } from '../QuestionOptions';
import { exerciseStyles, QuestionPrompt } from './QuestionParts';
import type { ExerciseProps } from './types';

export function WhoAmIQuestion({ question, answer, verified, onAnswer }: ExerciseProps<Question>) {
  const reduced = useMotionPreference();
  const [revealed, setRevealed] = useState(1);
  const visible = verified ? question.clues.length : revealed;
  return <View style={exerciseStyles.container}>
    <QuestionPrompt text={question.prompt} />
    <View style={styles.clues}><View style={styles.heading}><Lightbulb size={24} color={colors.tealInk} /><AppText variant="label" color={colors.tealInk}>PISTAS · {visible}/{question.clues.length}</AppText></View>{question.clues.slice(0, visible).map((clue, index) => <Animated.View key={`${question.id}:${index}`} entering={FadeInDown.duration(180).reduceMotion(reduced ? ReduceMotion.Always : ReduceMotion.System)} style={styles.clue}><AppText variant="label" color={colors.tealInk}>{index + 1}</AppText><AppText style={styles.text}>{clue}</AppText></Animated.View>)}</View>
    {!verified && revealed < question.clues.length ? <Button title="Mais uma pista" variant="secondary" icon={Lightbulb} onPress={() => setRevealed(value => Math.min(question.clues.length, value + 1))} /> : null}
    <QuestionOptions question={question} selected={typeof answer === 'string' ? answer : null} verified={verified} onSelect={onAnswer} />
  </View>;
}
const styles = StyleSheet.create({ clues: { backgroundColor: colors.primarySoft, padding: spacing.md, borderRadius: radius.lg, gap: spacing.md }, heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, clue: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }, text: { flex: 1 } });
