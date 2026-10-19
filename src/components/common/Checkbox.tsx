import { Pressable, StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { AppText } from './AppText';
import { colors } from '@/constants/theme';

export function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      aria-checked={checked}
      onPress={() => onChange(!checked)}
      style={styles.row}
    >
      <View style={[styles.box, checked && styles.checked]}>
        {checked ? <Check size={18} color="white" /> : null}
      </View>
      <AppText variant="small" style={styles.label}>
        {label}
      </AppText>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, alignItems: 'center', minHeight: 48 },
  box: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderRadius: 4,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checked: { backgroundColor: colors.primary, borderColor: colors.primary },
  label: { flex: 1 },
});
