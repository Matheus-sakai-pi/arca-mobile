import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { syncProfileAppearance } from '@/services/profileAppearance';
import type { ProfileAppearance, SavedProfileAppearance } from '@/lib/profileAppearance';

export function useProfileAppearance(owner: string | null, vip: boolean) {
  const generation = useRef(0);
  const [saved, setSaved] = useState<SavedProfileAppearance | null>(null);
  const [failure, setFailure] = useState<{ owner: string; message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const refresh = useCallback(async () => {
    if (!owner) return;
    const version = ++generation.current;
    setLoading(true);
    try {
      const next = await syncProfileAppearance(owner);
      if (version === generation.current) {
        setSaved(next);
        setFailure(null);
      }
    } catch {
      if (version === generation.current)
        setFailure({
          owner,
          message: 'Não foi possível carregar seu estilo. Confira a conexão e tente novamente.',
        });
    } finally {
      if (version === generation.current) setLoading(false);
    }
  }, [owner]);
  useFocusEffect(
    useCallback(() => {
      if (!vip) setSaved(value => (value?.vip ? { ...value, vip: false } : value));
      void refresh();
      return () => {
        generation.current++;
      };
    }, [refresh, vip]),
  );
  const save = useCallback(
    async (value: ProfileAppearance) => {
      if (!owner) throw new Error('Entre na sua conta para personalizar o perfil.');
      const version = ++generation.current;
      try {
        const next = await syncProfileAppearance(owner, value);
        if (version === generation.current) {
          setSaved(next);
          setFailure(null);
        }
      } finally {
        if (version === generation.current) setLoading(false);
      }
    },
    [owner],
  );
  return {
    appearance: saved?.owner === owner ? saved : null,
    loading,
    error: failure?.owner === owner ? failure.message : null,
    refresh,
    save,
  };
}
