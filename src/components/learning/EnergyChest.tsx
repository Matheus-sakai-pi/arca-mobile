import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Gift, RefreshCw, X } from 'lucide-react-native';
import { CHEST_ENERGY_CONFIG } from '@/config/energy';
import { colors } from '@/constants/theme';
import type { EnergyChest as ChestState, EnergyState } from '@/lib/energy';
import { useEnergy } from '@/providers/EnergyProvider';
import { useMotionPreference } from '@/hooks/useMotionPreference';
import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { IconButton } from '@/components/common/IconButton';
import { Notice } from '@/components/common/Notice';
import { RewardPulse } from '@/components/animation/RewardPulse';
import { BatteryIcon } from './BatteryIcon';
import { TrailMilestone } from './TrailMilestone';

export function EnergyChest({
  unitId,
  completed,
  total,
}: {
  unitId: string;
  completed: number;
  total: number;
}) {
  const { chest, status } = useEnergy();
  const reduced = useMotionPreference();
  const [reward, setReward] = useState<ChestState | null>(null);
  const [visible, setVisible] = useState(false),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null),
    [burst, setBurst] = useState(0);
  const mounted = useRef(true),
    inFlight = useRef<Promise<EnergyState | undefined> | null>(null);
  const refresh = useCallback(
    (claim = false): Promise<EnergyState | undefined> => {
      if (inFlight.current) return inFlight.current;
      setBusy(true);
      setError(null);
      const task = chest(unitId, claim)
        .then(next => {
          if (mounted.current && next.chest) {
            setReward(next.chest);
            if (claim) setBurst(value => value + 1);
          }
          return next;
        })
        .catch(cause => {
          if (mounted.current)
            setError(
              cause instanceof Error ? cause.message : 'Não foi possível conferir o baú. Tente novamente.',
            );
          return undefined;
        })
        .finally(() => {
          inFlight.current = null;
          if (mounted.current) setBusy(false);
        });
      inFlight.current = task;
      return task;
    },
    [chest, unitId],
  );
  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => {
      mounted.current = false;
    };
  }, [refresh]);
  const ready = reward?.eligible ?? completed >= Math.ceil(total * CHEST_ENERGY_CONFIG.completedFraction);
  const min = reward?.min ?? CHEST_ENERGY_CONFIG.min,
    max = reward?.max ?? CHEST_ENERGY_CONFIG.max;
  const full = !!status && !status.rules.bonusOverflow && status.balance >= status.rules.capacity;
  const room = status ? Math.max(0, status.rules.capacity - status.balance) : 0;
  const claimed = reward?.claimed ?? false;
  return (
    <>
      <Pressable
        testID={`chest-open-${unitId}`}
        accessibilityRole="button"
        accessibilityLabel={`${claimed ? 'Ver recompensa do baú' : 'Abrir baú'} da unidade`}
        onPress={() => {
          setVisible(true);
          void refresh();
        }}
        style={({ pressed }) => [styles.touch, pressed && styles.pressed]}
      >
        <TrailMilestone
          unitId={unitId}
          kind="chest"
          reached={ready}
          completed={reward?.completed ?? completed}
          total={reward?.total ?? total}
          claimed={claimed}
          rewardLabel={claimed ? `+${reward!.reward!.amount} energias recebidas` : `${min} a ${max} energias`}
        />
      </Pressable>
      <Modal
        transparent
        visible={visible}
        animationType={reduced ? 'none' : 'fade'}
        onRequestClose={() => setVisible(false)}
      >
        <ScrollView style={styles.overlay} contentContainerStyle={styles.center}>
          <View testID="energy-chest-dialog" accessibilityViewIsModal style={styles.dialog}>
            <View style={styles.heading}>
              <AppText accessibilityRole="header" variant="h2" style={styles.grow}>
                {claimed ? 'Recompensa recebida!' : 'Baú de energia'}
              </AppText>
              <IconButton icon={X} label="Fechar baú" onPress={() => setVisible(false)} />
            </View>
            <View style={styles.reward}>
              <RewardPulse event={burst} motion="rise">
                <BatteryIcon size={112} />
              </RewardPulse>
              <AppText testID="chest-reward-amount" variant="h2" color="#A51965">
                {claimed ? `+${reward!.reward!.amount} energias` : `${min} a ${max} energias`}
              </AppText>
            </View>
            {claimed ? (
              <>
                <AppText>
                  Este baú já foi resgatado. A recompensa foi adicionada à sua bateria uma única vez.
                </AppText>
                {reward!.reward!.amount < reward!.reward!.rolled ? (
                  <AppText color={colors.muted}>
                    O sorteio foi de {reward!.reward!.rolled} energias. Você recebeu {reward!.reward!.amount}{' '}
                    para respeitar a capacidade da bateria.
                  </AppText>
                ) : null}
              </>
            ) : (
              <>
                <AppText color={colors.muted}>
                  {ready
                    ? 'Sua recompensa está pronta. O sorteio acontece ao abrir o baú.'
                    : `Conclua ${reward?.target ?? Math.ceil(total * CHEST_ENERGY_CONFIG.completedFraction)} lições desta unidade para liberar a recompensa.`}
                </AppText>
                {status && !status.rules.bonusOverflow && ready ? (
                  <AppText color={colors.muted}>
                    {full
                      ? 'Sua bateria está cheia. O baú fica guardado para depois.'
                      : `Limite de ${status.rules.capacity} energias na bateria.${room < max ? ` Há espaço para ${room}; o excedente do sorteio não será acumulado.` : ''}`}
                  </AppText>
                ) : null}
              </>
            )}
            {error ? <Notice tone="error" message={error} /> : null}
            {!claimed && reward?.eligible ? (
              <Button
                title="Abrir e receber energia"
                icon={Gift}
                loading={busy}
                disabled={full || !status}
                onPress={() => {
                  void refresh(true);
                }}
              />
            ) : null}
            {!claimed ? (
              <Button
                title={busy ? 'Conferindo baú' : 'Atualizar baú'}
                variant="secondary"
                icon={RefreshCw}
                loading={busy}
                onPress={() => {
                  void refresh();
                }}
              />
            ) : (
              <Button title="Continuar" onPress={() => setVisible(false)} />
            )}
          </View>
        </ScrollView>
      </Modal>
    </>
  );
}
const styles = StyleSheet.create({
  touch: { borderRadius: 8 },
  pressed: { opacity: 0.8 },
  overlay: { flex: 1, backgroundColor: 'rgba(34,33,42,0.45)' },
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  dialog: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 20,
    gap: 16,
  },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  grow: { flex: 1, minWidth: 0 },
  reward: { alignItems: 'center', gap: 8 },
});
