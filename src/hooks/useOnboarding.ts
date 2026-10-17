import { useContext } from 'react';
import { OnboardingContext } from '@/providers/OnboardingProvider';
export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) throw new Error('useOnboarding requires OnboardingProvider');
  return context;
}
