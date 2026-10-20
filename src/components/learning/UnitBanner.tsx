import { Image, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/common/AppText';
import { artworkForUnit } from '@/constants/unitArtwork';
import { unitTrailTheme } from '@/lib/trailAppearance';
import type { LearningProgress, Unit } from '@/types/learning';

// Faixa colorida que separa as unidades na trilha única: cor da unidade cheia,
// base mais escura (estilo plano), título e a arte da unidade.
export function UnitBanner({ unit, index, progress }: { unit: Unit; index: number; progress: LearningProgress }) {
  const theme = unitTrailTheme(index);
  const art = artworkForUnit(unit.id);
  const completed = unit.lessons.filter(lesson => progress.completedLessonIds.includes(lesson.id)).length;
  return (
    <View
      testID={`unit-banner-${unit.id}`}
      accessible
      accessibilityRole="header"
      accessibilityLabel={`Unidade ${index + 1}: ${unit.title}, ${completed} de ${unit.lessons.length} lições concluídas`}
      style={[styles.banner, { backgroundColor: theme.color, borderBottomColor: theme.side }]}
    >
      <View style={styles.heading}>
        <AppText variant="label" color={theme.ink} style={styles.label}>
          UNIDADE {index + 1}
        </AppText>
        <AppText variant="h3" color={theme.ink} style={styles.title}>
          {unit.title}
        </AppText>
        <AppText variant="small" color={theme.ink} style={styles.count}>
          {completed} de {unit.lessons.length} lições
        </AppText>
      </View>
      <Image testID={`unit-art-${unit.id}`} source={art.image} accessible={false} resizeMode="contain" style={styles.art} />
    </View>
  );
}
const styles = StyleSheet.create({
  banner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingLeft: 18,
    paddingRight: 10,
    borderRadius: 20,
    borderBottomWidth: 6,
  },
  heading: { flex: 1, minWidth: 0, gap: 2 },
  label: { opacity: 0.85, letterSpacing: 0.6 },
  title: { fontSize: 20, lineHeight: 26 },
  count: { opacity: 0.9 },
  art: { width: 76, height: 76, flexShrink: 0 },
});
