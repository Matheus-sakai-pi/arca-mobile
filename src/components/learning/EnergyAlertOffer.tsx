import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Bell } from '@/components/icons';
import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { useAuth } from '@/hooks/useAuth';
import { enableEnergyAlerts, loadPushPreferences, pushDeviceRegistered, pushSupported } from '@/services/pushNotifications';
import { colors, spacing, surfaces } from '@/constants/theme';

// Convite na bateria vazia: um toque pede a permissão do Android e liga o aviso de energia.
// Some quando o aviso já está ativo neste aparelho, para visitantes e fora do Android.
export function EnergyAlertOffer() {
  const { session } = useAuth();
  const owner = session?.user.id;
  return pushSupported && owner ? <ScopedOffer key={owner} owner={owner} /> : null;
}
function ScopedOffer({ owner }: { owner: string }) {
  const [state, setState] = useState<'checking' | 'offer' | 'busy' | 'done' | 'hidden'>('checking');
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    void (async () => {
      try {
        const [registered, prefs] = await Promise.all([pushDeviceRegistered(owner), loadPushPreferences(owner)]);
        if (alive.current) setState(registered && prefs.energy ? 'hidden' : 'offer');
      } catch {
        if (alive.current) setState('offer');
      }
    })();
    return () => {
      alive.current = false;
    };
  }, [owner]);
  async function enable() {
    setState('busy');
    setError(null);
    try {
      await enableEnergyAlerts(owner);
      if (alive.current) setState('done');
    } catch (cause) {
      if (!alive.current) return;
      setState('offer');
      setError(cause instanceof Error ? cause.message : 'Não foi possível ativar o aviso agora.');
    }
  }
  if (state === 'checking' || state === 'hidden') return null;
  return (
    <View testID="energy-alert-offer" style={styles.card}>
      <View style={styles.row}>
        <Bell size={30} />
        <AppText style={styles.text}>
          {state === 'done' ? 'Pronto! Vamos avisar quando a energia voltar.' : 'Quer um aviso quando a bateria recarregar?'}
        </AppText>
      </View>
      {state !== 'done' ? (
        <Button title="Me avise quando recarregar" variant="secondary" loading={state === 'busy'} onPress={() => void enable()} />
      ) : null}
      {error ? (
        <AppText variant="small" color={colors.error}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  card: { ...surfaces.card, padding: spacing.md, gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  text: { flex: 1, minWidth: 0, fontWeight: '700' },
});
