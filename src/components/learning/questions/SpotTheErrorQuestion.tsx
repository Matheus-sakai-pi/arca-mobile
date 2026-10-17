import { StyleSheet, Text, View } from 'react-native';
import { AppText } from '@/components/common/AppText';
import type { SpotTheErrorQuestion as Data } from '@/types/learning';
import { colors, fonts, spacing } from '@/constants/theme';
import { choiceTone, exerciseStyles, QuestionPrompt, toneColors } from './QuestionParts';
import type { ExerciseProps } from './types';

export function SpotTheErrorQuestion({ question, answer, verified, onAnswer }: ExerciseProps<Data>) {
  return <View style={exerciseStyles.container}><QuestionPrompt text={question.prompt} /><View style={styles.paper}><AppText variant="label" color={colors.muted}>LEITURA ATENTA</AppText><Text style={styles.paragraph}>{question.options.map(part => {
    const palette = toneColors[choiceTone(answer === part.id, question.correctAnswer === part.id, verified)];
    return <Text key={part.id} accessibilityRole="button" accessibilityLabel={part.label} accessibilityState={{ disabled: verified, selected: answer === part.id }} onPress={verified ? undefined : () => onAnswer(part.id)} style={{ color: palette.ink, backgroundColor: palette.background, textDecorationLine: answer === part.id || verified && question.correctAnswer === part.id ? 'underline' : 'none' }}>{part.label}{' '}</Text>;
  })}</Text></View></View>;
}
const styles = StyleSheet.create({ paper: { gap: spacing.md, paddingVertical: spacing.md, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border }, paragraph: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 42, color: colors.text } });
