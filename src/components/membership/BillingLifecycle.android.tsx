import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import type { Purchase } from 'expo-iap';
import { useAuth } from '@/hooks/useAuth';
import { useMembership } from '@/providers/MembershipProvider';
import { MEMBERSHIP_CONFIG as config } from '@/config/membership';
import { deliverPurchase } from '@/lib/billingDelivery';

// Keep delayed Play payments and purchase deliveries alive outside the VIP screen.
const iap = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-iap') as typeof import('expo-iap');
  } catch {
    return null;
  }
})();
export function BillingLifecycle() {
  const { session } = useAuth();
  return session && iap ? <AccountBilling key={session.user.id} owner={session.user.id} /> : null;
}
function AccountBilling({ owner }: { owner: string }) {
  const { status, verify } = useMembership(),
    active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const receive = useCallback(
    async (purchase: Purchase) => {
      if (!active.current || purchase.productId !== config.productId || !purchase.purchaseToken) return;
      try {
        await deliverPurchase(owner, purchase, verify, value =>
          iap!.finishTransaction({ purchase: value, isConsumable: false }),
        );
      } catch {
        /* The receipt remains in Play and is retried on foreground/restore. */
      }
    },
    [owner, verify],
  );
  const useIAP = iap!.useIAP;
  const { connected, getAvailablePurchases, availablePurchases } = useIAP({
    onPurchaseSuccess: purchase => {
      void receive(purchase);
    },
  });
  useEffect(() => {
    if (!connected || !status?.billingReady) return;
    void getAvailablePurchases().catch(() => undefined);
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active') void getAvailablePurchases().catch(() => undefined);
    });
    return () => listener.remove();
  }, [connected, status?.billingReady, getAvailablePurchases]);
  useEffect(() => {
    void Promise.resolve().then(async () => {
      for (const purchase of availablePurchases) await receive(purchase);
    });
  }, [availablePurchases, receive]);
  return null;
}
