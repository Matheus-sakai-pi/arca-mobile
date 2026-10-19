import { useState } from 'react';
import { router } from 'expo-router';
import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { useAuth } from '@/hooks/useAuth';
import { MEMBERSHIP_CONFIG as config } from '@/config/membership';
import { formatMembershipPrice } from '@/lib/membership';
import { PlanChoices, type PurchasePanelProps } from './PlanChoices';
import { offerStyles } from './OfferLayout';
export function PurchasePreview({ children, native = false }: PurchasePanelProps & { native?: boolean }) {
  const { session } = useAuth();
  const [plan, setPlan] = useState<string>(config.yearlyPlan);
  return children({
    plans: <PlanChoices selected={plan} onSelect={setPlan} />,
    checkout: (
      <>
        <AppText variant="label" style={offerStyles.center}>
          {formatMembershipPrice(plan === config.yearlyPlan ? config.yearlyBRL : config.monthlyBRL)}
          {plan === config.yearlyPlan ? '/ano' : '/mês'} ·
          renovação automática
        </AppText>
        <Button
          title={
            session
              ? native
                ? 'Atualize o Arca para assinar'
                : 'Disponível no Android'
              : 'Entrar para assinar'
          }
          disabled={!!session}
          onPress={() => router.push('/(auth)/login')}
        />
        <AppText style={offerStyles.small}>
          {native ? 'Atualize o aplicativo pela Google Play.' : 'Nenhuma compra é realizada nesta prévia.'}
        </AppText>
      </>
    ),
  });
}
