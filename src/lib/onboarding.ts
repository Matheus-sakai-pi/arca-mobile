import { canVerify } from './questionEngine.ts';
import type { MultipleChoiceQuestion } from '../types/learning.ts';

export const onboardingSteps = ['welcome', 'practice', 'energy', 'ready'] as const;
export type OnboardingStep = typeof onboardingSteps[number];
export type OnboardingState = { step: OnboardingStep; answer: string | null; verified: boolean };
export type OnboardingAction = { type: 'next' | 'back' | 'skip' | 'verify' | 'retry' } | { type: 'answer'; answer: string };
export const initialOnboarding: OnboardingState = { step: 'welcome', answer: null, verified: false };

// This example is deliberately outside the curriculum and never becomes a lesson attempt.
export const onboardingQuestion: MultipleChoiceQuestion = {
  id: 'onboarding-example', type: 'multiple_choice',
  prompt: 'Qual destes livros é um Evangelho?',
  options: [{ id: 'mateus', label: 'Mateus' }, { id: 'genesis', label: 'Gênesis' }, { id: 'salmos', label: 'Salmos' }],
  correctAnswer: 'mateus',
  explanation: 'Mateus é um dos quatro Evangelhos, ao lado de Marcos, Lucas e João.',
};

export function reduceOnboarding(state: OnboardingState, action: OnboardingAction): OnboardingState {
  const index = onboardingSteps.indexOf(state.step);
  switch (action.type) {
    case 'skip': return { ...state, step: 'ready' };
    case 'back': return { ...state, step: onboardingSteps[index - 1] ?? 'welcome' };
    case 'next':
      if (state.step === 'practice' && !state.verified) return state;
      return { ...state, step: onboardingSteps[index + 1] ?? 'ready' };
    case 'answer':
      if (state.step !== 'practice' || state.verified || !onboardingQuestion.options.some(option => option.id === action.answer)) return state;
      return { ...state, answer: action.answer };
    case 'verify':
      return state.step === 'practice' && canVerify(onboardingQuestion, state.answer) ? { ...state, verified: true } : state;
    case 'retry':
      return state.step === 'practice' ? { ...state, answer: null, verified: false } : state;
  }
}
