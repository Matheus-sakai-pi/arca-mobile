import { createContext, useCallback, useEffect, useState, type PropsWithChildren } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const key = 'arca.onboarding.v1';
export const OnboardingContext = createContext<{ completed: boolean; loading: boolean; complete: () => Promise<void> } | null>(null);
export function OnboardingProvider({ children }: PropsWithChildren) {
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(key).then(value => { if (active) setCompleted(value === 'done'); })
      .catch(() => undefined).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const complete = useCallback(async () => {
    // Onboarding is a noncritical preference; restricted storage must not block sign-up.
    await AsyncStorage.setItem(key, 'done').catch(() => undefined);
    setCompleted(true);
  }, []);
  return <OnboardingContext.Provider value={{ completed, loading, complete }}>{children}</OnboardingContext.Provider>;
}
