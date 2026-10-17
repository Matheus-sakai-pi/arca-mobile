import { useCallback, useRef, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Bell, Check, RefreshCw, Zap } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Notice } from '@/components/common/Notice';
import { defaultPushPreferences, type PushPreferences } from '@/lib/pushNotifications';
import {
  loadPushPreferences,
  pushDeviceRegistered,
  pushSupported,
  savePushPreferences,
} from '@/services/pushNotifications';
import { colors } from '@/constants/theme';

export function PushSettings() {
  const { session } = useAuth();
  return <ScopedSettings key={session?.user.id ?? 'guest'} owner={session?.user.id} />;
}
function ScopedSettings({ owner }: { owner?: string }) {
  const [value, setValue] = useState(defaultPushPreferences),
    [saved, setSaved] = useState(defaultPushPreferences);
  const [registered, setRegistered] = useState(false);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [success, setSuccess] = useState(false);
  const active = useRef(false),
    locked = useRef(false),
    epoch = useRef(0);
  const refresh = useCallback(() => {
    if (!owner || !pushSupported || locked.current) return;
    const version = ++epoch.current;
    setLoading(true);
    void Promise.all([loadPushPreferences(owner), pushDeviceRegistered(owner)])
      .then(([next, device]) => {
        if (active.current && version === epoch.current) {
          setValue(next);
          setSaved(next);
          setRegistered(device);
          setError(null);
        }
      })
      .catch(() => {
        if (active.current && version === epoch.current)
          setError('Não foi possível consultar seus avisos. Tente novamente.');
      })
      .finally(() => {
        if (active.current && version === epoch.current) setLoading(false);
      });
  }, [owner]);
  useFocusEffect(
    useCallback(() => {
      active.current = true;
      refresh();
      return () => {
        active.current = false;
        epoch.current++;
      };
    }, [refresh]),
  );
  const dirty = value.energy !== saved.energy || value.comeback !== saved.comeback;
  async function save() {
    if (!owner || locked.current) return;
    locked.current = true;
    setBusy(true);
    setError(null);
    setSuccess(false);
    try {
      const next = await savePushPreferences(owner, value);
      if (active.current) {
        setSaved(next);
        setValue(next);
        setRegistered(next.energy || next.comeback);
        setSuccess(true);
      }
    } catch (cause) {
      if (active.current)
        setError(cause instanceof Error ? cause.message : 'Não foi possível salvar seus avisos.');
    } finally {
      locked.current = false;
      if (active.current) setBusy(false);
    }
  }
  function toggle(field: keyof Pick<PushPreferences, 'energy' | 'comeback'>, enabled: boolean) {
    setValue(previous => ({ ...previous, [field]: enabled }));
    setSuccess(false);
  }
  const disabled = !owner || !pushSupported || loading || busy;
  return (
    <View testID="push-settings" style={styles.section}>
      <AppText variant="h3" accessibilityRole="header">
        Avisos do Arca
      </AppText>
      <View style={styles.row}>
        <Zap size={23} color={colors.tealInk} />
        <View style={styles.grow}>
          <AppText>Energia disponível</AppText>
          <AppText variant="small" color={colors.muted}>
            Quando sua energia voltar ou recarregar por completo.
          </AppText>
        </View>
        <Switch
          accessibilityLabel="Avisos de energia"
          value={value.energy}
          disabled={disabled}
          onValueChange={enabled => toggle('energy', enabled)}
          trackColor={{ false: colors.track, true: colors.primary }}
        />
      </View>
      <View style={styles.row}>
        <Bell size={23} color={colors.primaryDark} />
        <View style={styles.grow}>
          <AppText>Voltar à jornada</AppText>
          <AppText variant="small" color={colors.muted}>
            Um convite após 3 dias sem abrir o Arca, no máximo uma vez por semana.
          </AppText>
        </View>
        <Switch
          accessibilityLabel="Avisos de retorno"
          value={value.comeback}
          disabled={disabled}
          onValueChange={enabled => toggle('comeback', enabled)}
          trackColor={{ false: colors.track, true: colors.primary }}
        />
      </View>
      <AppText variant="small" color={colors.muted}>
        No máximo um aviso automático por dia, entre 8h e 20h no seu fuso horário. O lembrete diário acima é
        independente.
      </AppText>
      {!owner ? (
        <Notice message="Entre na sua conta para receber avisos de energia e da sua jornada." />
      ) : !pushSupported ? (
        <Notice message="Os avisos automáticos estão disponíveis no aplicativo Android atualizado. A prévia web não envia notificações." />
      ) : (
        <>
          {error ? (
            <>
              <Notice tone="error" message={error} />
              <Button
                title="Consultar avisos"
                icon={RefreshCw}
                variant="quiet"
                disabled={busy}
                onPress={refresh}
              />
            </>
          ) : null}
          {success ? <Notice tone="success" message="Preferências de avisos salvas." /> : null}
          <Button
            title={
              !registered && (value.energy || value.comeback) && !dirty
                ? 'Ativar neste aparelho'
                : 'Salvar avisos'
            }
            icon={Check}
            loading={busy}
            disabled={loading || (!dirty && (registered || !(value.energy || value.comeback)))}
            onPress={() => void save()}
          />
        </>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  section: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 24, marginTop: 12, gap: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 70 },
  grow: { flex: 1, minWidth: 0, gap: 4 },
});
