import { StyleSheet, View } from 'react-native';
import { Tabs } from 'expo-router';
import { Award, BookOpen, House, Trophy, UserRound, UsersRound, type LucideIcon } from '@/components/icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '@/constants/theme';

// Estilo plano: ícones ilustrados sem texto; a aba ativa ganha um quadro azul-claro com borda.
function TabIcon({ icon: Icon, focused }: { icon: LucideIcon; focused: boolean }) {
  return (
    <View style={[styles.icon, focused && styles.activeIcon]}>
      <Icon size={30} />
    </View>
  );
}
const tabs: { name: string; title: string; icon: LucideIcon }[] = [
  { name: 'home', title: 'Início', icon: House },
  { name: 'learn', title: 'Aprender', icon: BookOpen },
  { name: 'ranking', title: 'Ranking', icon: Trophy },
  { name: 'friends', title: 'Amigos', icon: UsersRound },
  { name: 'achievements', title: 'Conquistas', icon: Award },
  { name: 'profile', title: 'Perfil', icon: UserRound },
];
export default function TabLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      initialRouteName="home"
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarItemStyle: styles.item,
        tabBarStyle: [
          styles.bar,
          { height: 68 + Math.max(insets.bottom, spacing.xs), paddingBottom: Math.max(insets.bottom, spacing.xs) },
        ],
      }}
    >
      {tabs.map(tab => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarAccessibilityLabel: tab.title,
            tabBarIcon: ({ focused }) => <TabIcon icon={tab.icon} focused={focused} />,
          }}
        />
      ))}
    </Tabs>
  );
}
const styles = StyleSheet.create({
  icon: {
    width: 50,
    height: 46,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIcon: { backgroundColor: colors.primarySoft, borderColor: '#9CC0FF' },
  item: { marginHorizontal: 0, paddingVertical: spacing.xxs },
  bar: {
    backgroundColor: colors.surface,
    borderTopWidth: 2,
    borderTopColor: colors.border,
    paddingTop: spacing.xs,
    paddingHorizontal: spacing.xxs,
  },
});
