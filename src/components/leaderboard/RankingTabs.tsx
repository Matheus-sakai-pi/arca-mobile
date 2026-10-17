import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/common/AppText';
import { colors } from '@/constants/theme';
import type { RankingScope } from '@/types/leaderboard';

const tabs = [
  { value: 'total', label: 'XP TOTAL' },
  { value: 'weekly', label: 'XP SEMANAL' },
  { value: 'friends', label: 'AMIGOS' },
] as const;
export function RankingTabs({
  value,
  onChange,
}: {
  value: RankingScope;
  onChange: (value: RankingScope) => void;
}) {
  return (
    <View accessibilityRole="tablist" style={styles.tabs}>
      {tabs.map(tab => (
        <Pressable
          key={tab.value}
          accessibilityRole="tab"
          accessibilityLabel={tab.label}
          aria-selected={tab.value === value}
          accessibilityState={{ selected: tab.value === value }}
          onPress={() => onChange(tab.value)}
          style={({ pressed }) => [
            styles.tab,
            tab.value === value && styles.selected,
            pressed && styles.pressed,
          ]}
        >
          <AppText
            variant="label"
            color={tab.value === value ? colors.primaryDark : colors.muted}
            style={styles.text}
          >
            {tab.label}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(240,246,255,0.92)',
    borderRadius: 32,
    padding: 4,
    gap: 2,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    paddingVertical: 8,
    borderRadius: 28,
  },
  selected: { backgroundColor: colors.surface },
  pressed: { opacity: 0.75 },
  text: { fontSize: 12, lineHeight: 17, textAlign: 'center' },
});
