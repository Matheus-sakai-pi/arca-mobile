import { Redirect } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useOnboarding } from '@/hooks/useOnboarding';

export default function Index() {
  const { session, isGuest, isRecovery } = useAuth();
  const { completed } = useOnboarding();
  if (isRecovery) return <Redirect href="/auth/reset-password" />;
  if (session || isGuest) return <Redirect href="/(tabs)/home" />;
  return <Redirect href={completed ? '/(auth)/login' : '/onboarding'} />;
}
