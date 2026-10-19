import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { CircleAlert, RefreshCw, type LucideIcon } from '@/components/icons';
import { AppText } from './AppText';
import { Button } from './Button';
import { colors, radius, spacing } from '@/constants/theme';
import { Mascot } from '@/components/mascot/Mascot';
import { VisualArtwork } from '@/components/animation/VisualArtwork';
import type { ArtworkKey } from '@/lib/visualContent';

export function LoadingState({ message = 'Preparando sua jornada…' }: { message?: string }) {
  return (
    <View testID="loading-state" accessibilityLiveRegion="polite" style={styles.loading}>
      <Mascot state="thinking" size={88} decorative />
      <View style={styles.loadingLabel}>
        <ActivityIndicator size="small" color={colors.primary} />
        <AppText variant="small" color={colors.muted} style={styles.center}>
          {message}
        </AppText>
      </View>
    </View>
  );
}
export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View testID="error-state" accessibilityLiveRegion="polite" style={styles.state}>
      <View style={[styles.icon, styles.errorIcon]}>
        <CircleAlert color={colors.error} size={28} />
      </View>
      <AppText accessibilityRole="header" variant="h3" style={styles.center}>
        Não foi possível carregar
      </AppText>
      <AppText color={colors.muted} style={styles.center}>
        {message}
      </AppText>
      <Button
        title="Tentar novamente"
        icon={RefreshCw}
        onPress={onRetry}
        variant="secondary"
        style={styles.retry}
      />
    </View>
  );
}
export function EmptyState({
  icon: Icon,
  title,
  message,
  artwork,
}: {
  icon: LucideIcon;
  title: string;
  message: string;
  artwork?: ArtworkKey;
}) {
  return (
    <View testID="empty-state" style={styles.state}>
      {artwork ? (
        <VisualArtwork name={artwork} />
      ) : (
        <View style={styles.icon}>
          <Icon color={colors.primaryDark} size={28} />
        </View>
      )}
      <AppText accessibilityRole="header" variant="h3" style={styles.center}>
        {title}
      </AppText>
      <AppText color={colors.muted} style={styles.center}>
        {message}
      </AppText>
    </View>
  );
}
const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  state: {
    alignItems: 'center',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 360,
    padding: spacing.lg,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md + 4,
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorIcon: { backgroundColor: colors.errorSoft },
  retry: { alignSelf: 'stretch', marginTop: spacing.xs },
  loadingLabel: { alignItems: 'center', gap: spacing.sm },
  center: { textAlign: 'center' },
});
