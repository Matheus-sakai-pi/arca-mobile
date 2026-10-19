import { View, StyleSheet } from 'react-native';
import { BookOpen } from '@/components/icons';
import { AppText } from './AppText';
import { colors, spacing } from '@/constants/theme';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <View accessibilityLabel="Arca" style={styles.brand}>
      <BookOpen color={colors.primary} size={compact ? 25 : 30} strokeWidth={2.5} />
      <AppText variant={compact ? 'h2' : 'display'} color={colors.primaryDark}>
        Arca
      </AppText>
    </View>
  );
}
const styles = StyleSheet.create({ brand: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' } });
