import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Crown, RefreshCw } from '@/components/icons';
import * as Crypto from 'expo-crypto';
import type { Purchase, SubscriptionOffer } from 'expo-iap';
import { Button } from '@/components/common/Button';
import { AppText } from '@/components/common/AppText';
import { Notice } from '@/components/common/Notice';
import { useAuth } from '@/hooks/useAuth';
import { useMembership } from '@/providers/MembershipProvider';
import { MEMBERSHIP_CONFIG as config } from '@/config/membership';
import { deliverPurchase } from '@/lib/billingDelivery';
import { formatMembershipPrice } from '@/lib/membership';
import { PlanChoices, type PurchasePanelProps } from './PlanChoices';
import { PurchasePreview } from './PurchasePreview';
import { offerStyles } from './OfferLayout';

// Older installed builds must keep working until a build with the native module is installed.
const iap = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-iap') as typeof import('expo-iap');
  } catch {
    return null;
  }
})();
export function PurchasePanel(props: PurchasePanelProps) {
  const { session } = useAuth();
  if (!iap || !session) return <PurchasePreview {...props} native />;
  return <NativePurchases {...props} />;
}
function NativePurchases({ children }: PurchasePanelProps) {
  const { session } = useAuth(),
    { status, verify } = useMembership();
  const [plan, setPlan] = useState<string>(config.yearlyPlan),
    [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ message: string; tone: 'error' | 'success' } | null>(null);
  const active = useRef(true),
    processing = useRef(new Set<string>());
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const confirm = useCallback(
    async (purchase: Purchase) => {
      const token = purchase.purchaseToken;
      if (
        !token ||
        purchase.productId !== config.productId ||
        processing.current.has(token) ||
        !active.current
      )
        return;
      processing.current.add(token);
      setBusy(true);
      try {
        if (
          !(await deliverPurchase(session!.user.id, purchase, verify, value =>
            iap!.finishTransaction({ purchase: value, isConsumable: false }),
          ))
        ) {
          if (active.current)
            setNotice({
              tone: 'success',
              message: 'Pagamento pendente na Google Play. O VIP será liberado após a confirmação.',
            });
          return;
        }
        if (active.current)
          setNotice({ tone: 'success', message: 'Compra conferida. Seus benefícios foram atualizados.' });
      } catch (cause) {
        if (active.current)
          setNotice({
            tone: 'error',
            message:
              cause instanceof Error
                ? cause.message
                : 'Não foi possível confirmar a compra. Tente restaurar.',
          });
      } finally {
        processing.current.delete(token);
        if (active.current) setBusy(processing.current.size > 0);
      }
    },
    [verify, session],
  );
  const useIAP = iap!.useIAP;
  const store = useIAP({
    onPurchaseSuccess: purchase => {
      void confirm(purchase);
    },
    onPurchaseError: error => {
      if (!active.current) return;
      setBusy(false);
      if (error.code !== iap!.ErrorCode.UserCancelled)
        setNotice({
          tone: 'error',
          message: 'A Google Play não concluiu a compra. Tente novamente ou restaure suas compras.',
        });
    },
    onError: () => {
      if (active.current) {
        setBusy(false);
        setNotice({
          tone: 'error',
          message: 'Não foi possível conectar à Google Play. Tente atualizar os planos.',
        });
      }
    },
  });
  const { connected, fetchProducts, availablePurchases } = store;
  const product = store.subscriptions.find(
    item => item.id === config.productId && item.platform === 'android',
  );
  const offers =
    product?.platform === 'android'
      ? product.subscriptionOffers.filter(
          item =>
            item.offerTokenAndroid &&
            !item.installmentPlanDetailsAndroid &&
            item.pricingPhasesAndroid?.pricingPhaseList.length === 1,
        )
      : [];
  const offer = (id: string): SubscriptionOffer | undefined =>
    offers.find(item => item.basePlanIdAndroid === id);
  useEffect(() => {
    if (connected && status?.billingReady)
      void fetchProducts({ skus: [config.productId], type: 'subs' }).catch(() => undefined);
  }, [connected, fetchProducts, status?.billingReady]);
  useEffect(() => {
    void Promise.resolve().then(async () => {
      for (const purchase of availablePurchases) await confirm(purchase);
    });
  }, [availablePurchases, confirm]);
  async function buy() {
    const selected = offer(plan);
    if (busy || !selected?.offerTokenAndroid || !session || !status?.billingReady || status.vip) return;
    setBusy(true);
    setNotice(null);
    try {
      const account = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, session.user.id);
      await store.requestPurchase({
        type: 'subs',
        request: {
          google: {
            skus: [config.productId],
            obfuscatedAccountId: account,
            subscriptionOffers: [{ sku: config.productId, offerToken: selected.offerTokenAndroid }],
          },
        },
      });
    } catch {
      setNotice({ tone: 'error', message: 'Não foi possível abrir o pagamento na Google Play.' });
    } finally {
      if (active.current) setBusy(false);
    }
  }
  return children({
    plans: !status?.vip ? (
      <PlanChoices
        selected={plan}
        onSelect={setPlan}
        disabled={busy}
        prices={
          status?.billingReady
            ? {
                [config.monthlyPlan]: offer(config.monthlyPlan)?.displayPrice,
                [config.yearlyPlan]: offer(config.yearlyPlan)?.displayPrice,
              }
            : undefined
        }
      />
    ) : null,
    checkout: (
      <View style={styles.section}>
        {!status?.vip ? (
          <AppText variant="label" style={offerStyles.center}>
            {offer(plan)?.displayPrice ??
              formatMembershipPrice(plan === config.yearlyPlan ? config.yearlyBRL : config.monthlyBRL)}
            {plan === config.yearlyPlan ? '/ano' : '/mês'} · renovação automática
          </AppText>
        ) : null}
        {!status?.billingReady ? (
          <Notice message="As assinaturas ainda não estão disponíveis para compra." />
        ) : (
          <>
            {!status.vip ? (
              <>
                <Button
                  title="Assinar pela Google Play"
                  icon={Crown}
                  loading={busy}
                  disabled={!store.connected || !offer(plan)}
                  onPress={() => void buy()}
                />
              </>
            ) : null}
            <Button
              title="Restaurar compras"
              variant="quiet"
              disabled={busy || !store.connected}
              icon={RefreshCw}
              onPress={() => {
                setNotice(null);
                void store
                  .getAvailablePurchases()
                  .catch(() =>
                    setNotice({ tone: 'error', message: 'Não foi possível restaurar. Tente novamente.' }),
                  );
              }}
            />
            <Button
              title="Atualizar planos"
              variant="quiet"
              disabled={busy}
              onPress={() => {
                void (
                  store.connected
                    ? store.fetchProducts({ skus: [config.productId], type: 'subs' })
                    : store.reconnect()
                ).catch(() => undefined);
              }}
            />
          </>
        )}
        {notice ? <Notice {...notice} /> : null}
      </View>
    ),
  });
}
const styles = StyleSheet.create({
  section: { gap: 12 },
});
