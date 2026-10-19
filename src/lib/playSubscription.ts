import { MEMBERSHIP_CONFIG as config } from '../config/membership.ts';

type RecordValue = Record<string, unknown>;
const record = (v: unknown): v is RecordValue => !!v && typeof v === 'object' && !Array.isArray(v);
export function verifiedPlaySubscription(value: unknown, account: string) {
  if (
    !record(value) ||
    !record(value.externalAccountIdentifiers) ||
    value.externalAccountIdentifiers.obfuscatedExternalAccountId !== account
  )
    throw new Error('purchase_owner_mismatch');
  if (
    !['ACKNOWLEDGEMENT_STATE_PENDING', 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED'].includes(
      String(value.acknowledgementState),
    )
  )
    throw new Error('purchase_acknowledgement_invalid');
  if (!Array.isArray(value.lineItems) || value.lineItems.length !== 1)
    throw new Error('purchase_product_invalid');
  const item: unknown = value.lineItems[0];
  const pending = value.subscriptionState === 'SUBSCRIPTION_STATE_PENDING';
  const cancelledPending = value.subscriptionState === 'SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED';
  if (
    !record(item) ||
    item.productId !== config.productId ||
    !record(item.offerDetails) ||
    !(
      item.offerDetails.basePlanId === config.monthlyPlan ||
      item.offerDetails.basePlanId === config.yearlyPlan
    ) ||
    (!pending &&
      !cancelledPending &&
      (typeof item.expiryTime !== 'string' || !Number.isFinite(Date.parse(item.expiryTime)))) ||
    typeof value.subscriptionState !== 'string'
  )
    throw new Error('purchase_product_invalid');
  const states = [
    'SUBSCRIPTION_STATE_ACTIVE',
    'SUBSCRIPTION_STATE_IN_GRACE_PERIOD',
    'SUBSCRIPTION_STATE_CANCELED',
    'SUBSCRIPTION_STATE_ON_HOLD',
    'SUBSCRIPTION_STATE_PAUSED',
    'SUBSCRIPTION_STATE_EXPIRED',
    'SUBSCRIPTION_STATE_PENDING',
    'SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED',
  ];
  if (!states.includes(value.subscriptionState)) throw new Error('purchase_state_invalid');
  return {
    product: config.productId,
    plan: String(item.offerDetails.basePlanId),
    state: value.subscriptionState,
    expiry: pending || cancelledPending ? '1970-01-01T00:00:00.000Z' : (item.expiryTime as string),
    renew: record(item.autoRenewingPlan) && item.autoRenewingPlan.autoRenewEnabled === true,
    needsAcknowledgement: value.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_PENDING',
    pending,
  };
}
