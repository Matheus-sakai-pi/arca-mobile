import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { AppText } from '@/components/common/AppText';
import { MEMBERSHIP_CONFIG as config } from '@/config/membership';
import { formatMembershipPrice } from '@/lib/membership';
import { offerColors } from './OfferLayout';
export type PurchaseContent = { plans: ReactNode; checkout: ReactNode };
export type PurchasePanelProps = { children: (content: PurchaseContent) => ReactNode };
export function PlanChoices({
  selected,
  onSelect,
  prices,
  disabled = false,
}: {
  selected: string;
  onSelect: (plan: string) => void;
  prices?: Record<string, string | undefined>;
  disabled?: boolean;
}) {
  return (
    <View
      testID="vip-plans"
      style={styles.plans}
      accessibilityRole="radiogroup"
      accessibilityLabel="Plano do Arca VIP"
    >
      {[
        {
          id: config.yearlyPlan,
          label: 'Anual',
          price: formatMembershipPrice(config.yearlyBRL),
          period: '/ano',
          detail: `${formatMembershipPrice(config.yearlyBRL / 12)} por mês · cobrado por ano`,
        },
        {
          id: config.monthlyPlan,
          label: 'Mensal',
          price: formatMembershipPrice(config.monthlyBRL),
          period: '/mês',
          detail: 'Cobrado mensalmente',
        },
      ].map(plan => (
        <Pressable
          key={plan.id}
          accessibilityRole="radio"
          accessibilityLabel={`Plano ${plan.label}`}
          accessibilityState={{ checked: selected === plan.id, disabled }}
          aria-checked={selected === plan.id}
          disabled={disabled}
          onPress={() => onSelect(plan.id)}
          style={[styles.plan, selected === plan.id && styles.selected]}
        >
          <View style={[styles.radio, selected === plan.id && styles.radioSelected]}>
            {selected === plan.id ? <Check size={14} color="white" strokeWidth={3} /> : null}
          </View>
          <View style={styles.copy}>
            <View style={styles.titleRow}>
              <AppText variant="label" style={styles.label}>
                {plan.label}
              </AppText>
              {plan.id === config.yearlyPlan && !prices ? (
                <AppText variant="label" style={styles.saving}>
                  ECONOMIZE {Math.floor((1 - config.yearlyBRL / (config.monthlyBRL * 12)) * 100)}%
                </AppText>
              ) : null}
            </View>
            <AppText style={styles.detail}>{prices ? 'Renovação automática' : plan.detail}</AppText>
          </View>
          <View style={styles.price}>
            <AppText variant="h3" style={styles.amount}>
              {prices ? (prices[plan.id] ?? 'Indisponível') : plan.price}
            </AppText>
            <AppText style={styles.period}>{plan.period}</AppText>
          </View>
        </Pressable>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  plans: { gap: 10 },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    minHeight: 78,
    borderWidth: 2,
    borderColor: '#E5E9EF',
    borderRadius: 8,
    backgroundColor: 'white',
  },
  selected: { borderColor: offerColors.green, backgroundColor: '#F3FCF7' },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#CFD6DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { backgroundColor: offerColors.green, borderColor: offerColors.green },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  titleRow: { gap: 3 },
  label: { fontSize: 16, color: offerColors.ink },
  detail: { fontSize: 11, lineHeight: 15, color: offerColors.muted },
  saving: { fontSize: 10, lineHeight: 13, color: offerColors.green },
  price: { alignItems: 'flex-end', flexShrink: 0, maxWidth: '43%' },
  amount: { fontSize: 18, lineHeight: 24, color: offerColors.ink },
  period: { fontSize: 11, lineHeight: 15, color: offerColors.muted },
});
