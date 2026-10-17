import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/common/AppText';
import { colors, spacing } from '@/constants/theme';
export function TabHeader({ title, subtitle, light = false, contrast = false }: { title: string; subtitle?: string; light?: boolean; contrast?: boolean }) {
  return <View style={[styles.header, contrast && styles.contrast]}><AppText accessibilityRole="header" variant="display" color={light && !contrast ? colors.surface : colors.primaryDark}>{title}</AppText>{subtitle ? <AppText color={light && !contrast ? colors.surface : colors.muted}>{subtitle}</AppText> : null}</View>;
}
const styles = StyleSheet.create({ header: { gap: spacing.xs }, contrast: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderRadius: 16, padding: spacing.sm } });
