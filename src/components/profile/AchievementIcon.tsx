import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect, Text as SvgText } from 'react-native-svg';
import { Award, BookOpen, Compass, Crown, Fish, Flame, Leaf, Mail, MessageCircle, ScrollText, ShieldCheck, Sparkles, Sprout, Star, Target, Trophy, UsersRound, Zap, type LucideIcon } from '@/components/icons';
import type { AchievementId } from '@/lib/achievements';
import { fonts } from '@/constants/theme';

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
  unit_3: { tone: '#DDF7E6', ring: '#24914F', icon: Leaf, label: '3' },
  unit_4: { tone: '#DCF3FF', ring: '#2A9BD8', icon: Compass, label: '4' },
  unit_5: { tone: '#EEE6FF', ring: '#7B4FE0', icon: Crown, label: '5' },
  unit_6: { tone: '#D9F7F4', ring: '#14A79C', icon: MessageCircle, label: '6' },
  unit_7: { tone: '#FFF4CC', ring: '#E8A317', icon: Sparkles, label: '7' },
  unit_8: { tone: '#D9F7F4', ring: '#1E8F87', icon: Fish, label: '8' },
  unit_9: { tone: '#DCEBFF', ring: '#3A6FE0', icon: UsersRound, label: '9' },
  unit_10: { tone: '#FFEFE3', ring: '#E07A3A', icon: Mail, label: '10' },
  course_complete: { tone: '#FFF4CC', ring: '#C98A0B', icon: Trophy },
  lessons_25: { tone: '#DCEBFF', ring: '#1E7BFF', icon: BookOpen, label: '25' },
  lessons_50: { tone: '#FFF1D2', ring: '#C9952E', icon: ScrollText, label: '50' },
  lessons_100: { tone: '#DCEBFF', ring: '#0B5BD9', icon: ShieldCheck, label: '100' },
  streak_14: { tone: '#FFE9D6', ring: '#FF7A2E', icon: Flame, label: '14' },
  streak_30: { tone: '#FFE3E4', ring: '#E5484D', icon: Flame, label: '30' },
  streak_100: { tone: '#EEE6FF', ring: '#8A4FE8', icon: Flame, label: '100' },
  xp_2500: { tone: '#FFF4CC', ring: '#E8A317', icon: Zap, label: '2500' },
  xp_5000: { tone: '#FFF4CC', ring: '#B9820A', icon: Award, label: '5000' },
  xp_10000: { tone: '#FFEFD0', ring: '#A86B00', icon: Trophy, label: '10k' },
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
        <SvgText x={24} y={40.6} fontSize={8} fontWeight="800" fontFamily={fonts.heavy} fill="#FFFFFF" textAnchor="middle">{medal.label}</SvgText>
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
