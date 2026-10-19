import { Pressable, StyleSheet } from 'react-native';
import type { LucideIcon } from '@/components/icons';
import { colors, layout, radius } from '@/constants/theme';

export function IconButton({
  icon: Icon,
  label,
  onPress,
  disabled = false,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, (pressed || disabled) && { opacity: 0.65 }]}
    >
      <Icon color={colors.text} size={22} />
    </Pressable>
  );
}
const styles = StyleSheet.create({
  button: {
    width: layout.iconButton,
    height: layout.iconButton,
    // Estilo plano: quadrado arredondado com base mais grossa, como os botões.
    borderRadius: radius.md - 2,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: colors.border,
  },
});
