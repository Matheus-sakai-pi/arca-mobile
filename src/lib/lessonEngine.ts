import type { Lesson, LessonAnswers, Question, QuestionAnswer } from '../types/learning.ts';
import { canVerify, copyAnswer, evaluateQuestion, isValidAnswer } from './questionEngine.ts';

export type LessonAttempt = {
  index: number;
  answer: QuestionAnswer | null;
  phase: 'answering' | 'feedback' | 'finished';
  answers: LessonAnswers;
  remaining: readonly number[] | null;
  mastered: readonly string[];
  turn: number;
};
export type LessonAction = { type: 'answer'; answer: QuestionAnswer } | { type: 'verify' } | { type: 'continue' } | { type: 'read' };
export function createAttempt(): LessonAttempt {
  return { index: 0, answer: null, phase: 'answering', answers: {}, remaining: null, mastered: [], turn: 0 };
}
export function isCorrect(question: Question, answer: unknown): boolean {
  return evaluateQuestion(question, answer);
}
export function reduceAttempt(lesson: Lesson, state: LessonAttempt, action: LessonAction): LessonAttempt {
  const question = lesson.questions[state.index];
  if (!question || state.phase === 'finished') return state;
  if (action.type === 'read' && question.type === 'content_card' && state.phase === 'answering') {
    const next = { ...state, answers: { ...state.answers, [question.id]: 'seen' } };
    return advanceAttempt(lesson, next, false);
  }
  if (action.type === 'answer' && state.phase === 'answering' && isValidAnswer(question, action.answer)) {
    return { ...state, answer: copyAnswer(action.answer) };
  }
  if (action.type === 'verify' && state.phase === 'answering' && canVerify(question, state.answer)) {
    // First answers determine accuracy/XP; retries only clear the learning queue.
    return { ...state, phase: 'feedback',
      answers: Object.hasOwn(state.answers, question.id) ? state.answers : { ...state.answers, [question.id]: copyAnswer(state.answer) },
      mastered: isCorrect(question, state.answer) ? [...state.mastered, question.id] : state.mastered,
    };
  }
  if (action.type === 'continue' && state.phase === 'feedback') {
    return advanceAttempt(lesson, state, !isCorrect(question, state.answer));
  }
  return state;
}
function advanceAttempt(lesson: Lesson, state: LessonAttempt, retry: boolean): LessonAttempt {
  const remaining = [...(state.remaining ?? lesson.questions.map((_question, index) => index).slice(1))];
  if (retry) remaining.push(state.index);
  const index = remaining.shift();
  return index === undefined ? { ...state, remaining: [], phase: 'finished' }
    : { ...state, index, remaining, answer: null, phase: 'answering', turn: state.turn + 1 };
}
export function scoreAnswers(lesson: Lesson, answers: LessonAnswers): { correct: number; total: number; accuracy: number } {
  if (!lesson.questions.length || Object.keys(answers).length !== lesson.questions.length || lesson.questions.some(question => !canVerify(question, answers[question.id]))) {
    throw new Error('Responda todas as perguntas antes de concluir.');
  }
  const exercises = lesson.questions.filter(question => question.type !== 'content_card');
  if (!exercises.length) throw new Error('Esta lição ainda não tem exercícios.');
  const correct = exercises.filter(question => isCorrect(question, answers[question.id]!)).length;
  const total = exercises.length;
  return { correct, total, accuracy: Math.round(correct / total * 100) };
}
export function calculateXP(correct: number, total: number): number {
  return correct * 2 + 10 + (correct === total ? 5 : 0);
}
