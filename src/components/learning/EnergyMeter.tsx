import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Clock3, RefreshCw, X } from 'lucide-react-native';
import { useEnergy } from '@/providers/EnergyProvider';
import { energyWait, energyIntervalText } from '@/lib/energy';
import { AppText } from '@/components/common/AppText';
import { IconButton } from '@/components/common/IconButton';
import { Button } from '@/components/common/Button';
import { Notice } from '@/components/common/Notice';
import { VisualArtwork } from '@/components/animation/VisualArtwork';
import { ProgressBar } from './ProgressBar';
import { BatteryIcon } from './BatteryIcon';
import { colors } from '@/constants/theme';

export function EnergyMeter({ inline = false, lesson = false }: { inline?: boolean; lesson?: boolean }) {
  const { status, receivedAt, loading, error, refresh } = useEnergy();
  const [visible, setVisible] = useState(false),
    [, tick] = useState(0);
  useEffect(() => {
    if (!visible) return;
    const timer = setInterval(() => tick(value => value + 1), 1000);
    return () => clearInterval(timer);
  }, [visible]);
  const label = loading
    ? 'Conferindo bateria'
    : !status
      ? 'Bateria: atualizar'
      : `${status.balance} de ${status.rules.capacity} energias${error ? ', conferir conexão' : ''}`;
  return (
    <>
      <Pressable
        testID={lesson ? 'lesson-energy-meter' : 'energy-meter'}
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => {
          setVisible(true);
          void refresh();
        }}
        style={[inline || lesson ? styles.inline : styles.meter, lesson && styles.lesson]}
      >
        <BatteryIcon size={lesson ? 30 : 32} />
        <AppText variant="label" style={styles.value}>
          {status ? `${status.balance}` : loading ? '...' : '!'}
        </AppText>
      </Pressable>
      <Modal transparent visible={visible} animationType="none" onRequestClose={() => setVisible(false)}>
        <ScrollView style={styles.overlay} contentContainerStyle={styles.center}>
          <View testID="energy-details" style={styles.dialog} accessibilityViewIsModal>
            <View style={styles.row}>
              <AppText accessibilityRole="header" variant="h2" style={styles.grow}>
                Sua bateria
              </AppText>
              <IconButton icon={X} label="Fechar energia" onPress={() => setVisible(false)} />
            </View>
            <VisualArtwork name="energy" size={96} animated={visible} />
            {status ? (
              <>
                <AppText variant="h2">
                  {status.balance} de {status.rules.capacity} energias
                </AppText>
                <ProgressBar
                  value={Math.min(100, (status.balance / status.rules.capacity) * 100)}
                  label="Carga da bateria"
                />
                {status.nextRefillAt ? (
                  <View style={styles.row}>
                    <Clock3 size={18} color={colors.muted} />
                    <AppText style={styles.grow} color={colors.muted}>
                      Próxima energia: {energyWait(status, receivedAt)}
                    </AppText>
                  </View>
                ) : null}
                <AppText color={colors.muted}>
                  Cada exercício usa {status.rules.exerciseCost} energia na primeira resposta da tentativa,
                  acertando ou errando. As correções dos erros no fim da tentativa e as leituras não gastam
                  energia.
                </AppText>
                <AppText color={colors.muted}>
                  Você recupera 1 a cada {energyIntervalText(status.rules.refillSeconds)}, até{' '}
                  {status.rules.capacity}.
                </AppText>
                <AppText color={colors.muted}>
                  Sequências de {status.rules.streakMilestones.join(' e ')} acertos: bônus de{' '}
                  {status.rules.streakBonusMin} a {status.rules.streakBonusMax}. Lição perfeita: +
                  {status.rules.perfectBonus}.
                </AppText>
                <AppText variant="small" color={colors.muted}>
                  Bônus não se repetem na mesma lição.{' '}
                  {status.rules.bonusOverflow
                    ? 'Os bônus podem ultrapassar a capacidade.'
                    : 'O total não ultrapassa a capacidade da bateria.'}{' '}
                  Desafios entre amigos continuam gratuitos.
                </AppText>
                <AppText variant="small" color={colors.muted}>
                  As respostas e a recarga precisam de conexão. O saldo só muda após confirmação do servidor.
                </AppText>
              </>
            ) : null}
            {error ? <Notice tone="error" message={error} /> : null}
            <Button
              title="Atualizar"
              accessibilityLabel="Atualizar energia"
              icon={RefreshCw}
              variant="secondary"
              onPress={() => void refresh()}
            />
          </View>
        </ScrollView>
      </Modal>
    </>
  );
}
const styles = StyleSheet.create({
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 44,
    paddingHorizontal: 4,
    flexShrink: 0,
  },
  lesson: {
    width: 66,
    height: 48,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#F6C5DF',
  },
  value: { fontSize: 17, lineHeight: 24, fontVariant: ['tabular-nums'] },
  meter: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#F6C5DF',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  grow: { flex: 1, minWidth: 0 },
  overlay: { flex: 1, backgroundColor: 'rgba(34,33,42,0.45)' },
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  dialog: {
    width: '100%',
    maxWidth: 420,
    padding: 20,
    gap: 16,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
});
