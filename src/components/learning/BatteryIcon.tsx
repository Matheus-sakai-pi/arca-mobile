import { BatteryCharge } from '@/components/icons';

export function BatteryIcon({ size = 32 }: { size?: number }) {
  return <BatteryCharge width={size} testID="battery-icon" />;
}
