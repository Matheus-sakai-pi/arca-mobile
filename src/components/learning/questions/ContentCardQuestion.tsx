import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/common/AppText';
import { colors, radius, spacing } from '@/constants/theme';
import type { ContentCardQuestion as Question } from '@/types/learning';
import { exerciseStyles, QuestionPrompt } from './QuestionParts';
import type { ExerciseProps } from './types';

export function ContentCardQuestion({ question }: ExerciseProps<Question>) {
  return <View style={exerciseStyles.container}><QuestionPrompt text={question.prompt} /><View style={styles.reading}><AppText>{question.body}</AppText></View></View>;
}
const styles = StyleSheet.create({ reading: { backgroundColor:colors.surface,borderRadius:radius.md,padding:spacing.lg } });
