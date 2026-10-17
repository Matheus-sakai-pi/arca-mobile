import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppText } from '@/components/common/AppText';
import { BatteryIcon } from './BatteryIcon';
import { energyIntervalText } from '@/lib/energy';
import { useEnergy } from '@/providers/EnergyProvider';
import { colors, radius, spacing } from '@/constants/theme';

export const BATTERY_TIP_KEY = 'arca.tips.battery.v1';

// Explica uma única vez, no aparelho, que cada resposta nova usa energia da bateria.
export function BatteryTip() {
  const energy = useEnergy();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(BATTERY_TIP_KEY)
      .then(seen => {
        if (active && !seen) setVisible(true);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  const rules = energy.status?.rules;
  if (!visible || !rules) return null;
  const dismiss = () => {
    setVisible(false);
    void AsyncStorage.setItem(BATTERY_TIP_KEY, '1').catch(() => undefined);
  };
  return (
    <View testID="battery-tip" accessibilityLiveRegion="polite" style={styles.tip}>
      <BatteryIcon size={28} />
      <AppText variant="small" color={colors.text} style={styles.copy}>
        Cada resposta nova usa {rules.exerciseCost} energia da bateria. Ela recarrega sozinha: 1 a cada{' '}
        {energyIntervalText(rules.refillSeconds)}, até {rules.capacity}.
      </AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Entendi a dica da bateria"
        onPress={dismiss}
        hitSlop={8}
        style={styles.button}
      >
        <AppText variant="label" color={colors.primaryDark}>
          Entendi
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  tip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
  },
  copy: { flex: 1, minWidth: 0 },
  button: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
});
