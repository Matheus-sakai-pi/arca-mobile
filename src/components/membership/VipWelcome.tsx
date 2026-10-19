import { useEffect, useState } from 'react';
import { Image, Modal, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { ReduceMotion, ZoomIn } from 'react-native-reanimated';
import { ArrowRight, BatteryFull, Camera, Crown, Palette, Sparkles, type LucideIcon } from 'lucide-react-native';
import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { VisualBurst } from '@/components/animation/VisualBurst';
import { useAuth } from '@/hooks/useAuth';
import { useMotionPreference } from '@/hooks/useMotionPreference';
import { accountStorage } from '@/lib/accountStorage';
import { rewardHaptic } from '@/lib/rewardHaptics';
import { nextVipWelcomeValue, shouldWelcomeVip, vipWelcomeKey } from '@/lib/vipWelcome';
import { useLearning } from '@/providers/LearningProvider';
import { useMembership } from '@/providers/MembershipProvider';
import { useRewardMotion } from '@/providers/RewardMotionProvider';
import { colors, spacing } from '@/constants/theme';
import { offerArt } from './OfferLayout';

export function VipWelcome() {
  const { session } = useAuth();
  return session ? <AccountVipWelcome key={session.user.id} owner={session.user.id} /> : null;
}
function AccountVipWelcome({ owner }: { owner: string }) {
  const { status } = useMembership();
  const { activeLessonId } = useLearning();
  const [pending, setPending] = useState(false);
  const vip = status?.owner === owner ? status.vip : null;
  useEffect(() => {
    if (vip === null) return;
    let alive = true;
    void (async () => {
      const key = vipWelcomeKey(owner);
      const stored = await accountStorage.getItem(key).catch(() => null);
      if (!alive) return;
      if (shouldWelcomeVip(stored, vip)) setPending(true);
      const next = nextVipWelcomeValue(stored, vip);
      if (next !== null) await accountStorage.setItem(key, next).catch(() => undefined);
    })();
    return () => {
      alive = false;
    };
  }, [owner, vip]);
  async function close(target?: '/(tabs)/profile') {
    setPending(false);
    // Só marca como visto ao fechar: se o app fechar antes, a boas-vindas aparece na próxima vez.
    await accountStorage.setItem(vipWelcomeKey(owner), 'true').catch(() => undefined);
    if (target) router.navigate(target);
  }
  // Não interrompe uma lição em andamento.
  const visible = pending && vip === true && !activeLessonId;
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={() => void close()}>
      <ScrollView style={styles.overlay} contentContainerStyle={styles.overlayContent}>
        {visible ? (
          <WelcomeCard
            event={`vip-welcome:${owner}:${status?.vipUntil ?? ''}`}
            onContinue={() => void close()}
            onProfile={() => void close('/(tabs)/profile')}
          />
        ) : null}
      </ScrollView>
    </Modal>
  );
}
const benefits: [LucideIcon, string][] = [
  [BatteryFull, 'Bateria ilimitada para estudar quanto quiser'],
  [Sparkles, '+10% de XP em cada lição nova'],
  [Palette, 'Molduras, fundos e selo VIP no perfil'],
  [Camera, 'Foto de perfil no lugar do avatar'],
];
function WelcomeCard({
  event,
  onContinue,
  onProfile,
}: {
  event: string;
  onContinue: () => void;
  onProfile: () => void;
}) {
  const { ledger } = useRewardMotion();
  const reduced = useMotionPreference();
  useEffect(() => {
    if (ledger.claim('vip-welcome-haptic', event)) rewardHaptic();
  }, [ledger, event]);
  return (
    <Animated.View
      testID="vip-welcome"
      accessibilityViewIsModal
      entering={ZoomIn.duration(220).reduceMotion(reduced ? ReduceMotion.Always : ReduceMotion.System)}
      style={styles.card}
    >
      <VisualBurst event={event} />
      <View style={styles.badge}>
        <Crown size={15} color={colors.goldInk} />
        <AppText variant="label" color={colors.goldInk}>
          ARCA VIP ATIVADO
        </AppText>
      </View>
      <Image source={offerArt.vip} style={styles.art} resizeMode="contain" accessible={false} />
      <AppText variant="h2" style={styles.center} accessibilityRole="header">
        Bem-vindo ao Arca VIP!
      </AppText>
      <AppText color={colors.muted} style={styles.center}>
        Obrigado por apoiar o Arca. Seus benefícios já estão valendo:
      </AppText>
      <View style={styles.list}>
        {benefits.map(([Icon, text]) => (
          <View key={text} style={styles.item}>
            <View style={styles.icon}>
              <Icon size={18} color={colors.goldInk} />
            </View>
            <AppText style={styles.itemText}>{text}</AppText>
          </View>
        ))}
      </View>
      <Button title="Continuar estudando" icon={ArrowRight} onPress={onContinue} />
      <Button title="Personalizar meu perfil" icon={Palette} variant="secondary" onPress={onProfile} />
    </Animated.View>
  );
}
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(34,33,42,0.42)' },
  overlayContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 8,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.gold,
    boxShadow: '0 12px 36px rgba(34,33,42,0.18)',
  },
  badge: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#FFF6DA',
  },
  art: { width: 132, height: 132, alignSelf: 'center' },
  center: { textAlign: 'center' },
  list: { gap: spacing.sm },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF6DA',
  },
  itemText: { flex: 1, minWidth: 0 },
});
