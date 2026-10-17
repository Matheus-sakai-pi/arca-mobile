import { StyleSheet, View, type ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import { BookOpen, House, Trophy, UserRound, type LucideIcon } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, shadows, spacing } from '@/constants/theme';

function TabIcon({ icon: Icon, color, focused }: { icon: LucideIcon; color: ColorValue; focused: boolean }) {
  return <View style={[styles.icon, focused && styles.activeIcon]}><Icon size={28} color={color} strokeWidth={2.2} /></View>;
}
export default function TabLayout() {
  const insets = useSafeAreaInsets();
  return <Tabs initialRouteName="home" screenOptions={{
    headerShown: false,
    tabBarActiveTintColor: colors.primaryDark,
    tabBarInactiveTintColor: colors.muted,
    tabBarLabelStyle: styles.label,
    tabBarItemStyle: styles.item,
    tabBarStyle: [styles.bar, { height: 82 + Math.max(insets.bottom, spacing.xs), paddingBottom: Math.max(insets.bottom, spacing.xs) }],
  }}>
    <Tabs.Screen name="home" options={{ title: 'Início', tabBarAccessibilityLabel: 'Início', tabBarIcon: ({ color, focused }) => <TabIcon icon={House} color={color} focused={focused} /> }} />
    <Tabs.Screen name="learn" options={{ title: 'Aprender', tabBarAccessibilityLabel: 'Aprender', tabBarIcon: ({ color, focused }) => <TabIcon icon={BookOpen} color={color} focused={focused} /> }} />
    <Tabs.Screen name="ranking" options={{ title: 'Ranking', tabBarAccessibilityLabel: 'Ranking', tabBarIcon: ({ color, focused }) => <TabIcon icon={Trophy} color={color} focused={focused} /> }} />
    <Tabs.Screen name="profile" options={{ title: 'Perfil', tabBarAccessibilityLabel: 'Perfil', tabBarIcon: ({ color, focused }) => <TabIcon icon={UserRound} color={color} focused={focused} /> }} />
  </Tabs>;
}
const styles = StyleSheet.create({
  label: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 18, letterSpacing: 0, marginHorizontal: 0 },
  icon: { width: 60, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  activeIcon: { backgroundColor: colors.primarySoft },
  item: { marginHorizontal: 0, borderRadius: radius.lg, paddingVertical: spacing.xxs },
  bar: { backgroundColor: colors.surface, borderTopWidth: 0, paddingTop: spacing.sm, paddingHorizontal: spacing.sm, borderTopLeftRadius: 36, borderTopRightRadius: 36, ...shadows.navigation },
});
