import { AnimatedProgressBar } from '@/components/animation/AnimatedProgressBar';

export function ProgressBar({
  value,
  label,
  compact = false,
  color,
  thick = false,
}: {
  value: number;
  label: string;
  compact?: boolean;
  color?: string;
  thick?: boolean;
}) {
  return <AnimatedProgressBar value={value} label={label} compact={compact} color={color} thick={thick} />;
}
