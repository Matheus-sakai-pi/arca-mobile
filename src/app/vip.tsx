import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { Crown } from '@/components/icons';
import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Notice } from '@/components/common/Notice';
import { PurchasePanel } from '@/components/membership/PurchasePanel';
import {
  OfferHero,
  OfferLayout,
  offerArt,
  offerColors,
  offerStyles,
} from '@/components/membership/OfferLayout';
import { VIPComparison } from '@/components/membership/VIPComparison';
import { Avatar } from '@/components/profile/Avatar';
import { useAuth } from '@/hooks/useAuth';
import { useMembership } from '@/providers/MembershipProvider';
import { MEMBERSHIP_CONFIG as config } from '@/config/membership';

export default function VIP() {
  const { session } = useAuth(),
    { status, error, refresh } = useMembership();
  const [linkError, setLinkError] = useState<string | null>(null);
  function back() {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/profile');
  }
  return (
    <PurchasePanel>
      {({ plans, checkout }) => (
        <OfferLayout
          tone="night"
          footer={
            <>
              {checkout}
              <Button title="Agora não" variant="quiet" onPress={back} />
            </>
          }
        >
          <OfferHero
            title="Arca VIP"
            subtitle="Bateria infinita. Mais XP. Seu ritmo."
            image={offerArt.vip}
            onBack={back}
            badge={<Crown size={24} color="#D7FF83" />}
          />
          <View style={offerStyles.section}>
            <VIPComparison />
            {status?.vip ? (
              <Notice
                tone="success"
                message={`Seu VIP está ativo até ${new Date(status.vipUntil!).toLocaleDateString('pt-BR')}.`}
              />
            ) : (
              <>
                <AppText style={offerStyles.heading}>Escolha seu plano</AppText>
                {plans}
              </>
            )}
            <View style={styles.avatars}>
              <View style={styles.faces}>
                <Avatar avatarKey="vip-sage" size={48} />
                <Avatar avatarKey="vip-explorer" size={48} />
              </View>
              <View style={styles.avatarCopy}>
                <AppText variant="label">Um perfil com a sua cara</AppText>
                <AppText variant="small" color={offerColors.muted}>
                  Retratos exclusivos para escolher.
                </AppText>
              </View>
            </View>
            <AppText style={offerStyles.small}>
              Renovação automática. Cancele quando quiser na Google Play. O XP extra vale para novas lições,
              com arredondamento para baixo.
            </AppText>
            {error && session ? (
              <>
                <Notice tone="error" message={error} />
                <Button title="Conferir benefícios" variant="quiet" onPress={() => void refresh()} />
              </>
            ) : null}
            {linkError ? <Notice tone="error" message={linkError} /> : null}
            <Button
              title="Gerenciar assinatura na Google Play"
              variant="quiet"
              onPress={() => {
                void Linking.openURL(
                  `https://play.google.com/store/account/subscriptions?sku=${config.productId}&package=${config.packageName}`,
                ).catch(() =>
                  setLinkError('Abra a Google Play e entre em Pagamentos e assinaturas > Assinaturas.'),
                );
              }}
            />
            <Button title="Política de Privacidade" variant="quiet" onPress={() => router.push('/privacy')} />
          </View>
        </OfferLayout>
      )}
    </PurchasePanel>
  );
}
const styles = StyleSheet.create({
  avatars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: offerColors.line,
  },
  faces: { flexDirection: 'row', gap: 5 },
  avatarCopy: { flex: 1, minWidth: 0, gap: 2 },
});
