import { useState, type Ref } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { Eye, EyeOff, type LucideIcon } from '@/components/icons';
import { AppText } from './AppText';
import { colors, fonts, layout, radius, spacing } from '@/constants/theme';

type Props = TextInputProps & {
  label: string;
  error?: string;
  icon?: LucideIcon;
  password?: boolean;
  inputRef?: Ref<TextInput>;
};
export function Field({ label, error, icon: Icon, password, inputRef, style, ...props }: Props) {
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.group}>
      <AppText variant="label">{label}</AppText>
      <View style={[styles.container, focused && styles.focus, !!error && styles.invalid]}>
        {Icon ? <Icon size={20} color={focused ? colors.primary : colors.muted} /> : null}
        <TextInput
          {...props}
          ref={inputRef}
          accessibilityLabel={label}
          placeholderTextColor={colors.muted}
          secureTextEntry={password && !visible}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          maxFontSizeMultiplier={1.5}
          style={[styles.input, style]}
        />
        {password ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Ocultar senha' : 'Mostrar senha'}
            accessibilityState={{ checked: visible }}
            hitSlop={4}
            style={styles.eye}
            onPress={() => setVisible(!visible)}
          >
            {visible ? <EyeOff size={20} color={colors.muted} /> : <Eye size={20} color={colors.muted} />}
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <AppText variant="small" color={colors.error} accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  group: { gap: spacing.xs },
  container: {
    minHeight: layout.inputHeight,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  focus: { borderColor: colors.primary },
  invalid: { borderColor: colors.error },
  input: {
    flex: 1,
    minWidth: 0,
    paddingVertical: spacing.md,
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.text,
    letterSpacing: 0,
  },
  eye: {
    minWidth: layout.touchTarget,
    minHeight: layout.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
