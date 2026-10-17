import { View } from 'react-native';
import { QuestionOptions } from '../QuestionOptions';
import type { MultipleChoiceQuestion as Question } from '@/types/learning';
import { exerciseStyles, QuestionPrompt } from './QuestionParts';
import type { ExerciseProps } from './types';

export function MultipleChoiceQuestion({ question, answer, verified, onAnswer }: ExerciseProps<Question>) {
  return <View style={exerciseStyles.container}><QuestionPrompt text={question.prompt} /><QuestionOptions question={question} selected={typeof answer === 'string' ? answer : null} verified={verified} onSelect={onAnswer} /></View>;
}
