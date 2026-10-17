import { createContext, useCallback, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AppState, Platform } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { sessionStorage } from '@/lib/sessionStorage';
import { authErrorMessage } from '@/services/validation';

type AuthContextValue = {
  session: Session | null;
  isGuest: boolean;
  loading: boolean;
  error: string | null;
  isRecovery: boolean;
  setRecovery: (value: boolean) => void;
  enterGuest: () => void;
  exitGuest: () => void;
  retry: () => void;
};
export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isGuest, setGuest] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRecovery, setRecoveryState] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const authRevision = useRef(0);
  const recoveryRevision = useRef(0);
  const guestRevision = useRef(0);
  const setRecovery = useCallback((value: boolean) => {
    recoveryRevision.current++;
    setRecoveryState(value);
    const write = value ? sessionStorage.setItem('arca.recovery', 'active') : sessionStorage.removeItem('arca.recovery');
    void write.catch(() => undefined);
  }, []);
  const retry = useCallback(() => { setLoading(true); setError(null); setAttempt(value => value + 1); }, []);

  useEffect(() => {
    let active = true;
    const client = supabase;
    if (!client) {
      void sessionStorage.getItem('arca.visitor').then(value=>{ if (active) setGuest(value === 'active'); })
        .catch(()=>undefined).finally(()=>{ if (active) setLoading(false); });
      return ()=>{ active=false; };
    }
    const { data: { subscription } } = client.auth.onAuthStateChange((event, next) => {
      authRevision.current++;
      if (!active) return;
      setSession(next);
      if (next) { guestRevision.current++; setGuest(false); void sessionStorage.removeItem('arca.visitor').catch(()=>undefined); }
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (event === 'SIGNED_OUT') { guestRevision.current++; setRecovery(false); setGuest(false); void sessionStorage.removeItem('arca.visitor').catch(()=>undefined); }
    });
    const revision = authRevision.current;
    const recoveryVersion = recoveryRevision.current;
    const guestVersion = guestRevision.current;
    Promise.all([client.auth.getSession(), sessionStorage.getItem('arca.recovery').catch(() => null), sessionStorage.getItem('arca.visitor').catch(()=>null)]).then(([{ data, error: sessionError }, recovery, visitor]) => {
      if (!active) return;
      if (sessionError) throw sessionError;
      if (revision === authRevision.current) setSession(data.session);
      if (guestVersion === guestRevision.current) setGuest(!data.session && visitor === 'active');
      if (recoveryVersion === recoveryRevision.current) setRecoveryState(!!data.session && recovery === 'active');
    }).catch((caught: unknown) => { if (active) setError(authErrorMessage(caught)); })
      .finally(() => { if (active) setLoading(false); });
    if (Platform.OS !== 'web') client.auth.startAutoRefresh();
    const appSubscription = Platform.OS !== 'web' ? AppState.addEventListener('change', state => {
      if (state === 'active') client.auth.startAutoRefresh(); else client.auth.stopAutoRefresh();
    }) : null;
    return () => { active = false; subscription.unsubscribe(); appSubscription?.remove(); if (Platform.OS !== 'web') client.auth.stopAutoRefresh(); };
  }, [attempt, setRecovery]);

  return <AuthContext.Provider value={{ session, isGuest, loading, error, isRecovery, setRecovery, enterGuest: () => { guestRevision.current++; setGuest(true); setError(null); void sessionStorage.setItem('arca.visitor','active').catch(()=>undefined); }, exitGuest: () => { guestRevision.current++; setGuest(false); void sessionStorage.removeItem('arca.visitor').catch(()=>undefined); }, retry }}>{children}</AuthContext.Provider>;
}
