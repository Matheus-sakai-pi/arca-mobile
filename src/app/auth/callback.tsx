import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { consumeAuthCallback } from '@/services/auth';
import { parseAuthCallback, pickAuthCallbackUrl } from '@/lib/authCallback';
import { authErrorMessage } from '@/services/validation';
import { useAuth } from '@/hooks/useAuth';
import { useOnboarding } from '@/hooks/useOnboarding';
import { Screen } from '@/components/common/Screen';
import { ErrorState, LoadingState } from '@/components/common/States';

export default function AuthCallback() {
  const incomingUrl = Linking.useURL();
  const { setRecovery } = useAuth();
  const { complete } = useOnboarding();
  const pending = useRef<{ url: string; promise: ReturnType<typeof consumeAuthCallback> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    async function handle() {
      // getLinkingURL acompanha o último link recebido, inclusive com o app já aberto.
      const url =
        Platform.OS === 'web'
          ? window.location.href
          : pickAuthCallbackUrl(Linking.getLinkingURL(), incomingUrl, await Linking.getInitialURL());
      if (!active) return;
      try {
        if (!url) throw new Error('auth_link_invalid');
        if (!pending.current || pending.current.url !== url) {
          const parsed = parseAuthCallback(url);
          setRecovery(parsed.recovery);
          pending.current = { url, promise: consumeAuthCallback(url) };
        }
        const result = await pending.current.promise;
        if (Platform.OS !== 'web') Linking.clearInitialURL();
        await complete();
        if (!active) return;
        // Remove credentials from browser history after consuming the email link.
        if (Platform.OS === 'web') window.history.replaceState(null, '', window.location.pathname);
        router.replace(result.recovery ? '/auth/reset-password' : '/(tabs)/home');
      } catch (caught) {
        if (active) {
          setRecovery(false);
          setError(authErrorMessage(caught));
        }
      }
    }
    void handle();
    return () => {
      active = false;
    };
  }, [incomingUrl, setRecovery, complete]);
  if (error)
    return (
      <Screen>
        <ErrorState message={error} onRetry={() => router.replace('/(auth)/forgot-password')} />
      </Screen>
    );
  return <LoadingState message="Confirmando seu acesso…" />;
}
