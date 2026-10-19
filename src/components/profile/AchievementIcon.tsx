import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect, Text as SvgText } from 'react-native-svg';
import { Award, BookOpen, Crown, Flame, ScrollText, Sprout, Star, Target, type LucideIcon } from '@/components/icons';
import type { AchievementId } from '@/lib/achievements';

// Medalhas planas: círculo colorido com borda mais escura, um ícone plano no centro e,
// quando ajuda, um número numa faixa. Bloqueadas ficam cinza.
const medals: Record<AchievementId, { tone: string; ring: string; icon: LucideIcon; label?: string }> = {
  first_step: { tone: '#DDF7E6', ring: '#3DBA6F', icon: Sprout },
  perfect_lesson: { tone: '#FFE3E4', ring: '#FF5A5F', icon: Target },
  streak_3: { tone: '#FFE9D6', ring: '#FF8C3C', icon: Flame, label: '3' },
  streak_7: { tone: '#FFE9D6', ring: '#F2A21B', icon: Flame, label: '7' },
  scholar: { tone: '#DCEBFF', ring: '#1E7BFF', icon: BookOpen, label: '10' },
  unit_1: { tone: '#FFF1D2', ring: '#E2B04A', icon: ScrollText, label: '1' },
  unit_2: { tone: '#EEE6FF', ring: '#9B6BFF', icon: Award, label: '2' },
  xp_500: { tone: '#FFF4CC', ring: '#F2A21B', icon: Star, label: '500' },
  xp_1000: { tone: '#FFF4CC', ring: '#D29A20', icon: Crown, label: '1000' },
};
export function AchievementIcon({ id, unlocked = true, size = 72 }: { id: AchievementId; unlocked?: boolean; size?: number }) {
  const medal = medals[id];
  const Icon = medal.icon;
  const ring = unlocked ? medal.ring : '#C3CBD8';
  return <View testID={`achievement-icon-${id}`} pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.frame, { width: size, height: size }, !unlocked && styles.locked]}>
    <Svg width={size} height={size} viewBox="0 0 48 48" style={StyleSheet.absoluteFill} aria-hidden>
      <Circle cx={24} cy={24} r={22} fill={ring} />
      <Circle cx={24} cy={23} r={18} fill={unlocked ? medal.tone : '#EEF1F5'} />
      <Path d="M11 17a15 15 0 0 1 17-10" stroke="rgba(255,255,255,0.7)" strokeWidth={3} strokeLinecap="round" fill="none" />
      {medal.label ? <>
        <Rect x={24 - (6 + medal.label.length * 3.6) / 2} y={33} width={6 + medal.label.length * 3.6} height={10} rx={5} fill={ring} />
        <SvgText x={24} y={40.6} fontSize={8} fontWeight="800" fill="#FFFFFF" textAnchor="middle">{medal.label}</SvgText>
      </> : null}
    </Svg>
    <View style={[styles.center, medal.label ? styles.raised : null]}><Icon size={size * 0.46} /></View>
  </View>;
}

const styles = StyleSheet.create({
  frame: { flexShrink: 0 },
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  raised: { paddingBottom: '14%' },
  locked: { opacity: 0.5 },
});
