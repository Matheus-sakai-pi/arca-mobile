import type { Question, QuestionAnswer } from '@/types/learning';

export type ExerciseProps<Q extends Question = Question> = {
  question: Q;
  answer: QuestionAnswer | null;
  verified: boolean;
  onAnswer: (answer: QuestionAnswer) => void;
};
