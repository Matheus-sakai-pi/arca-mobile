import { StyleSheet, View } from 'react-native';
import { Check, Crown, Minus } from 'lucide-react-native';
import { AppText } from '@/components/common/AppText';
import { offerColors } from './OfferLayout';
const rows = [
  ['Lições completas', 'check', 'check'],
  ['Bateria infinita', 'minus', 'check'],
  ['XP nas novas lições', 'Normal', '+10%'],
  ['Avatares exclusivos', 'minus', 'check'],
  ['Molduras e fundos de perfil', 'minus', 'check'],
] as const;
export function VIPComparison() {
  return (
    <View testID="vip-comparison" style={styles.table}>
      <View pointerEvents="none" style={styles.highlight} />
      <View style={styles.row}>
        <AppText variant="label" style={styles.feature}>
          SEUS BENEFÍCIOS
        </AppText>
        <AppText variant="label" style={styles.value}>
          GRÁTIS
        </AppText>
        <View style={styles.valueIcon}>
          <Crown size={16} color={offerColors.green} />
          <AppText variant="label" color={offerColors.green}>
            VIP
          </AppText>
        </View>
      </View>
      {rows.map(([label, free, vip]) => (
        <View
          key={label}
          style={styles.row}
          accessible
          accessibilityLabel={`${label}. Grátis: ${free === 'check' ? 'incluído' : free === 'minus' ? 'não incluído' : free}. VIP: ${vip === 'check' ? 'incluído' : vip}.`}
        >
          <AppText style={styles.feature}>{label}</AppText>
          <View style={styles.cell}>
            {free === 'check' ? (
              <Check size={21} strokeWidth={3} color={offerColors.ink} />
            ) : free === 'minus' ? (
              <Minus size={18} color="#A1A9B5" />
            ) : (
              <AppText style={styles.cellText}>{free}</AppText>
            )}
          </View>
          <View style={styles.cell}>
            {vip === 'check' ? (
              <Check size={22} strokeWidth={3} color={offerColors.green} />
            ) : (
              <AppText variant="label" color={offerColors.green}>
                {vip}
              </AppText>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  table: { position: 'relative', paddingVertical: 8 },
  highlight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 64,
    borderRadius: 8,
    backgroundColor: offerColors.mint,
  },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 47 },
  feature: { flex: 1, minWidth: 0, fontSize: 13, lineHeight: 19, paddingRight: 8, color: offerColors.ink },
  value: { width: 60, textAlign: 'center', fontSize: 11, color: offerColors.muted },
  valueIcon: { width: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  cell: { width: 62, alignItems: 'center', justifyContent: 'center' },
  cellText: { fontSize: 12, color: offerColors.muted },
});
