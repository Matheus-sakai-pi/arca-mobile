import { StyleSheet, View } from 'react-native';
import { Check, Flag } from '@/components/icons';
import { AppText } from '@/components/common/AppText';
import { VisualArtwork } from '@/components/animation/VisualArtwork';
import { journeyCheckpoint } from '@/lib/visualContent';
import { colors, spacing } from '@/constants/theme';

export function JourneyCheckpoint({ completed, total }: { completed: number; total: number }) {
  const checkpoint = journeyCheckpoint(completed, total);
  if (!checkpoint) return null;
  const Icon = checkpoint.finished ? Check : Flag;
  return (
    <View testID="journey-checkpoint" style={styles.row}>
      <VisualArtwork name="waypoint" size={80} animated={checkpoint.reached} />
      <View style={styles.text}>
        <View style={styles.label}>
          <Icon size={16} color={colors.tealInk} />
          <AppText variant="label" color={colors.tealInk}>
            {checkpoint.finished
              ? 'Unidade concluída'
              : checkpoint.reached
                ? 'Metade do caminho'
                : 'Próximo marco'}
          </AppText>
        </View>
        <AppText variant="small" color={colors.muted}>
          {checkpoint.done}/{checkpoint.total} lições concluídas
        </AppText>
        <AppText variant="label">
          {checkpoint.finished ? 'Mais uma etapa da sua jornada.' : `Rumo a ${checkpoint.target} lições`}
        </AppText>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderRadius: 8,
  },
  text: { flex: 1, minWidth: 0, gap: spacing.xxs },
  label: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xxs },
});
