import { StyleSheet, View } from 'react-native';
import Svg, { Ellipse, Path, Rect } from 'react-native-svg';
import { Star, Trophy } from 'lucide-react-native';
import { AppText } from '@/components/common/AppText';
import { colors } from '@/constants/theme';

export function TrailMilestone({ unitId, kind, reached, completed, total, claimed = false, decorative = false, rewardLabel }: { unitId: string; kind: 'chest' | 'trophy'; reached: boolean; completed: number; total: number; claimed?: boolean; decorative?: boolean; rewardLabel?: string }) {
  const gold = reached ? '#FFC52F' : '#D8DDE3';
  const side = reached ? '#CE9216' : '#A9B1BC';
  const label = kind === 'chest' ? claimed ? 'Baú resgatado' : reached ? 'Metade do caminho' : 'Baú de recompensa' : reached ? 'Unidade concluída' : 'Troféu da unidade';
  return <View testID={`trail-${kind}-${unitId}`} accessible={!decorative} accessibilityLabel={`${label}, ${reached ? 'desbloqueado' : 'bloqueado'}, ${completed} de ${total} lições concluídas`} style={styles.milestone}>
    <View testID={`trail-${kind}-art-${unitId}`} style={styles.art}>
      <Svg width={112} height={96} viewBox="0 0 112 96" style={StyleSheet.absoluteFill}><Ellipse cx={56} cy={88} rx={36} ry={5} fill="#EFF1F5" />
        {kind === 'chest' ? <>
          <Rect x={16} y={39} width={80} height={43} rx={8} fill={side} />
          <Rect x={16} y={31} width={80} height={42} rx={8} fill={gold} />
          <Path d="M16 39 V31 Q16 11 37 11 H75 Q96 11 96 31 V39 Z" fill={gold} stroke={side} strokeWidth={4} transform={claimed ? 'translate(0 -9) rotate(-12 16 39)' : undefined} />
          <Path d="M16 40 H96 M30 16 V72 M82 16 V72" stroke={side} strokeWidth={7} />
          <Rect x={45} y={32} width={22} height={24} rx={5} fill={reached ? '#FFF3BA' : '#F1F3F5'} stroke={side} strokeWidth={3} />
          <Path d={reached ? 'M50 44 L54 48 L62 39' : 'M56 41 V48'} stroke={side} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </> : null}
      </Svg>
      {kind === 'trophy' ? <><Trophy size={82} strokeWidth={2.4} color={side} fill={gold} style={styles.trophy} /><Star size={22} color={side} fill={reached ? '#FFF0A6' : '#EFF1F5'} style={styles.star} /></> : null}
    </View>
    <AppText variant="label" color={reached ? colors.text : colors.muted} style={styles.label}>{label}</AppText>
    <AppText variant="small" color={colors.muted}>{completed}/{total} lições concluídas</AppText>
    {rewardLabel ? <AppText variant="label" color="#A51965">{rewardLabel}</AppText> : null}
  </View>;
}
const styles = StyleSheet.create({
  milestone: { alignItems: 'center', gap: 2, paddingVertical: 18 },
  art: { width: 112, height: 96 },
  trophy: { position: 'absolute', top: 0, left: 15 },
  star: { position: 'absolute', top: 19, left: 45 },
  label: { textAlign: 'center' },
});
