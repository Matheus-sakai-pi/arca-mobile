import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle, type StyleProp } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { AppText } from './AppText';
import { colors, layout, radius, spacing } from '@/constants/theme';
import { pressHaptic } from '@/lib/rewardHaptics';

type Props = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'quiet';
  icon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};
export function Button({ title, onPress, variant = 'primary', icon: Icon, loading, disabled, style, accessibilityLabel }: Props) {
  const primary = variant === 'primary';
  const inactive = !!disabled || !!loading;
  const ink = disabled ? colors.muted : primary ? colors.surface : colors.primaryDark;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!disabled || !!loading, busy: !!loading }}
      disabled={disabled || loading}
      onPress={() => { if (primary) pressHaptic(); onPress(); }}
      style={[styles.base, styles[variant], disabled && styles.disabled, loading && styles.loading, style]}>
      {({ pressed }) => <View testID="button-face" style={[styles.face, primary && styles.primaryFace, variant === 'quiet' && styles.quietFace, disabled && styles.disabledFace, pressed && !inactive && variant !== 'quiet' && styles.pressed, pressed && variant === 'quiet' && styles.quietPressed]}><View style={styles.content}>
        {loading ? <ActivityIndicator color={ink} accessibilityLabel="Aguarde" /> : Icon ? <Icon size={20} color={ink} /> : null}
        <AppText variant="button" color={ink} style={styles.title}>{title}</AppText>
      </View></View>}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  base: { minHeight: layout.buttonHeight, borderRadius: radius.md, paddingBottom: 4, justifyContent: 'center' },
  primary: { backgroundColor: colors.primaryDark },
  secondary: { backgroundColor: colors.border },
  quiet: { backgroundColor: 'transparent' },
  face: { minHeight: layout.buttonHeight - 4, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, justifyContent: 'center' },
  primaryFace: { backgroundColor: colors.primary, borderColor: colors.primary },
  quietFace: { backgroundColor: 'transparent', borderColor: 'transparent' },
  content: { flexDirection: 'row', gap: spacing.xs, alignItems: 'center', justifyContent: 'center' },
  title: { textAlign: 'center', flexShrink: 1 },
  pressed: { transform: [{ translateY: 4 }] },
  quietPressed: { opacity: 0.65 },
  disabled: { backgroundColor: colors.border },
  disabledFace: { backgroundColor: colors.track, borderColor: colors.track },
  loading: { opacity: 0.8 },
});
