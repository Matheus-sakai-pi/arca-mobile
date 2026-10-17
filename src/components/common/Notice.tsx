import { StyleSheet, View } from 'react-native';
import { CircleAlert, CircleCheck, Info } from 'lucide-react-native';
import { AppText } from './AppText';
import { colors, radius, spacing } from '@/constants/theme';

export function Notice({ message, tone = 'info' }: { message: string; tone?: 'info' | 'error' | 'success' }) {
  const ink = tone === 'error' ? colors.error : tone === 'success' ? colors.success : colors.primaryDark;
  const backgroundColor =
    tone === 'error' ? colors.errorSoft : tone === 'success' ? colors.successSoft : colors.primarySoft;
  const Icon = tone === 'error' ? CircleAlert : tone === 'success' ? CircleCheck : Info;
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.container, { backgroundColor }]}
    >
      <Icon size={20} color={ink} />
      <AppText variant="small" color={ink} style={styles.message}>
        {message}
      </AppText>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.sm,
  },
  message: { flex: 1, minWidth: 0 },
});
