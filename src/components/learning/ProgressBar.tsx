import { AnimatedProgressBar } from '@/components/animation/AnimatedProgressBar';

export function ProgressBar({ value, label, compact=false }: { value: number; label: string; compact?:boolean }) {
  return <AnimatedProgressBar value={value} label={label} compact={compact} />;
}
