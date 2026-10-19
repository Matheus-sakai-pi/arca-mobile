import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { useEnergy } from './EnergyProvider';
import { decodeMembership, type Membership } from '@/lib/membership';
import { scopedSupabase, supabase } from '@/lib/supabase';
import { referralDevice } from '@/services/referralDevice';

type Context = {
  status: Membership | null;
  error: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
  verify: (token: string) => Promise<boolean>;
};
const MembershipContext = createContext<Context | null>(null);
export function MembershipProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  return (
    <ScopedMembership key={session?.user.id ?? 'guest'} owner={session?.user.id ?? null}>
      {children}
    </ScopedMembership>
  );
}
function ScopedMembership({ children, owner }: PropsWithChildren<{ owner: string | null }>) {
  const { refresh: refreshEnergy } = useEnergy();
  const [status, setStatus] = useState<Membership | null>(null),
    [error, setError] = useState<string | null>(null),
    [loading, setLoading] = useState(!!owner);
  const active = useRef(true),
    inFlight = useRef<Promise<void> | null>(null);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const refresh = useCallback(() => {
    if (!owner || !supabase) return Promise.resolve();
    if (inFlight.current) return inFlight.current;
    const client = scopedSupabase(supabase, owner);
    const task = (async () => {
      try {
        const device = await referralDevice();
        const { data, error: failure } = await client.rpc(
          'learning_membership',
          device ? { p_device: device } : {},
        );
        if (failure)
          throw new Error('Não foi possível conferir o VIP e os convites. Tente novamente mais tarde.');
        const next = decodeMembership(data, owner);
        if (active.current) {
          setStatus(next);
          setError(null);
        }
      } catch (cause) {
        if (active.current) {
          setStatus(null);
          setError(cause instanceof Error ? cause.message : 'Benefícios indisponíveis.');
        }
      } finally {
        if (active.current) setLoading(false);
        inFlight.current = null;
      }
    })();
    inFlight.current = task;
    return task;
  }, [owner]);
  useEffect(() => {
    void refresh();
    if (!owner) return;
    const timer = setInterval(() => void refresh(), 60000);
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active') {
        void refresh();
        void refreshEnergy();
      }
    });
    return () => {
      clearInterval(timer);
      listener.remove();
    };
  }, [owner, refresh, refreshEnergy]);
  const verify = useCallback(
    async (token: string) => {
      if (!owner || !supabase || !active.current) throw new Error('Entre na conta usada na compra.');
      const { data, error: failure } = await scopedSupabase(supabase, owner).functions.invoke(
        'play-billing',
        { body: { token } },
      );
      if (failure || !data || typeof data.pending !== 'boolean')
        throw new Error(
          'A compra ainda não pôde ser confirmada. Use Restaurar compras para tentar novamente, sem comprar outra vez.',
        );
      if (data.pending) return false;
      await refresh();
      await refreshEnergy();
      return true;
    },
    [owner, refresh, refreshEnergy],
  );
  return (
    <MembershipContext.Provider value={{ status, error, loading, refresh, verify }}>
      {children}
    </MembershipContext.Provider>
  );
}
export function useMembership() {
  const value = useContext(MembershipContext);
  if (!value) throw new Error('MembershipProvider ausente.');
  return value;
}
