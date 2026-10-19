import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import * as Linking from 'expo-linking';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { Check, Copy, Gift, MessageCircle, RefreshCw, UsersRound } from 'lucide-react-native';
import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { IconButton } from '@/components/common/IconButton';
import { Notice } from '@/components/common/Notice';
import {
  OfferHero,
  OfferLayout,
  offerArt,
  offerColors,
  offerStyles,
} from '@/components/membership/OfferLayout';
import { BatteryIcon } from '@/components/learning/BatteryIcon';
import { useAuth } from '@/hooks/useAuth';
import { useMembership } from '@/providers/MembershipProvider';
import { referralMessage } from '@/lib/membership';
import { MEMBERSHIP_CONFIG } from '@/config/membership';
import { fonts } from '@/constants/theme';

export default function Invite() {
  const { session } = useAuth(),
    { status, error, loading, refresh } = useMembership();
  const [shareError, setShareError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const days = status?.rewardDays ?? MEMBERSHIP_CONFIG.referralDays;
  function back() {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/profile');
  }
  async function share() {
    if (!status) return;
    setShareError(null);
    try {
      await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(referralMessage(status.code))}`);
    } catch {
      setShareError('Não foi possível abrir o WhatsApp. Tente novamente ou compartilhe seu código.');
    }
  }
  async function copyCode() {
    if (!status || copying) return;
    const code = status.code;
    setCopiedCode(null);
    setCopyError(null);
    setCopying(true);
    try {
      // Expo's legacy web fallback can report success even when copying is denied.
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(code);
      } else if (!(await Clipboard.setStringAsync(code))) {
        throw new Error('clipboard_unavailable');
      }
      setCopiedCode(code);
    } catch {
      setCopyError('Não foi possível copiar. Selecione o código para copiar manualmente.');
    } finally {
      setCopying(false);
    }
  }
  return (
    <OfferLayout
      tone="mint"
      footer={
        <>
          {session ? (
            <Button
              title="Convidar pelo WhatsApp"
              icon={MessageCircle}
              disabled={!status || loading}
              onPress={() => void share()}
            />
          ) : (
            <Button title="Criar conta para convidar" onPress={() => router.push('/(auth)/signup')} />
          )}
          <AppText style={offerStyles.small}>
            Você escolhe para quem enviar. Sem acesso aos seus contatos.
          </AppText>
        </>
      }
    >
      <OfferHero
        tone="mint"
        title="Melhor com amigos"
        subtitle="Uma nova companhia. Um presente para os dois."
        image={offerArt.invite}
        onBack={back}
        badge={<Gift color={offerColors.green} size={23} />}
      />
      <View style={offerStyles.section}>
        <View style={styles.reward}>
          <BatteryIcon size={58} />
          <View style={styles.rewardCopy}>
            <AppText style={styles.days}>{days} dias</AppText>
            <AppText variant="label" color={offerColors.green}>
              de bateria infinita para cada um
            </AppText>
          </View>
        </View>
        <View testID="referral-steps" style={styles.steps}>
          {[
            [MessageCircle, 'Envie seu convite', 'Compartilhe pelo WhatsApp.'],
            [UsersRound, 'Seu amigo entra na jornada', 'Ele cria a conta e aceita seu convite.'],
            [Check, 'Primeira lição concluída', `Vocês dois recebem ${days} dias de bateria infinita.`],
          ].map(([Icon, title, detail], index) => {
            const StepIcon = Icon as typeof Check;
            return (
              <View key={String(title)} style={styles.step}>
                <View style={styles.stepTrack}>
                  <View style={styles.stepIcon}>
                    <StepIcon size={18} color={offerColors.green} />
                  </View>
                  {index < 2 ? <View style={styles.connector} /> : null}
                </View>
                <View style={styles.stepCopy}>
                  <AppText variant="label" style={styles.stepTitle}>
                    {String(title)}
                  </AppText>
                  <AppText style={styles.detail}>{String(detail)}</AppText>
                </View>
              </View>
            );
          })}
        </View>
        {status?.referralUntil ? (
          <Notice
            tone="success"
            message={`Bateria infinita até ${new Date(status.referralUntil).toLocaleString('pt-BR')}.`}
          />
        ) : null}
        {session && status ? (
          <View style={styles.receipt}>
            <View style={styles.code}>
              <AppText variant="label" color={offerColors.muted}>
                SEU CÓDIGO
              </AppText>
              <AppText selectable style={styles.codeValue}>
                Seu código: {status.code}
              </AppText>
            </View>
            <View {...(Platform.OS === 'web' ? { title: 'Copiar código' } : {})}>
              <IconButton
                icon={copiedCode === status.code ? Check : Copy}
                label="Copiar código"
                disabled={copying}
                onPress={() => void copyCode()}
              />
            </View>
            <IconButton
              icon={RefreshCw}
              label="Conferir convites"
              disabled={loading}
              onPress={() => void refresh()}
            />
            {copiedCode === status.code ? (
              <AppText accessibilityLiveRegion="polite" style={styles.copied}>
                Código copiado!
              </AppText>
            ) : null}
            <AppText style={[styles.detail, styles.receiptStatus]}>
              {status.invites.rewarded} premiados · {status.invites.pending} aguardando
              {status.invites.blocked ? ` · ${status.invites.blocked} não elegíveis` : ''}
            </AppText>
          </View>
        ) : session ? (
          <Button
            title="Conferir convites"
            icon={RefreshCw}
            variant="secondary"
            loading={loading}
            onPress={() => void refresh()}
          />
        ) : null}
        {copyError || shareError || error ? (
          <Notice tone="error" message={copyError ?? shareError ?? error!} />
        ) : null}
        <AppText style={offerStyles.small}>
          Ao aceitar o convite no cadastro, vocês já viram amigos. Cada amigo novo que conclui a primeira
          lição dá mais {days} dias para você e recebe {days} dias também. Seus dias se acumulam.
          Válido em celulares Android diferentes; o mesmo aparelho não gera outra recompensa. Não é necessário
          confirmar o e-mail. O convite não inclui XP extra nem avatares VIP.
        </AppText>
        {Platform.OS !== 'android' ? (
          <AppText style={offerStyles.small}>
            A validação dos aparelhos acontece no aplicativo Android.
          </AppText>
        ) : null}
      </View>
    </OfferLayout>
  );
}
const styles = StyleSheet.create({
  reward: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: offerColors.line,
  },
  rewardCopy: { flexShrink: 1 },
  days: { fontFamily: fonts.heavy, fontSize: 34, lineHeight: 41, color: offerColors.ink },
  steps: { paddingTop: 4 },
  step: { flexDirection: 'row', gap: 12, minHeight: 70 },
  stepTrack: { width: 34, alignItems: 'center' },
  stepIcon: {
    width: 34,
    height: 34,
    backgroundColor: offerColors.mint,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connector: { width: 2, flex: 1, backgroundColor: '#DAECE3', marginVertical: 4 },
  stepCopy: { flex: 1, gap: 2, paddingBottom: 17, paddingTop: 3 },
  stepTitle: { fontSize: 15, color: offerColors.ink },
  detail: { fontSize: 12, lineHeight: 18, color: offerColors.muted },
  receipt: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: offerColors.line,
    paddingVertical: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 7,
  },
  code: { flex: 1, minWidth: 150, gap: 4 },
  copied: { width: '100%', fontSize: 12, lineHeight: 18, color: offerColors.green },
  receiptStatus: { width: '100%' },
  codeValue: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 19, color: offerColors.ink },
});
