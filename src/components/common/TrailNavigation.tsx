import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { House, BookOpen, Trophy, UserRound } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, shadows } from '@/constants/theme';
import { AppText } from './AppText';

const tabs = [
  { name: 'home', label: 'Início', icon: House, href: '/(tabs)/home' },
  { name: 'learn', label: 'Aprender', icon: BookOpen, href: '/(tabs)/learn' },
  { name: 'ranking', label: 'Ranking', icon: Trophy, href: '/(tabs)/ranking' },
  { name: 'profile', label: 'Perfil', icon: UserRound, href: '/(tabs)/profile' },
] as const;
export function TrailNavigation() {
  const insets = useSafeAreaInsets();
  return <View testID="trail-navigation" accessibilityRole="tablist" style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
    {tabs.map(({ name, label, icon: Icon, href }) => <Pressable key={name} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: name === 'learn' }} aria-selected={name === 'learn'} onPress={() => router.navigate(href)} style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
      <View style={[styles.icon, name === 'learn' && styles.active]}><Icon size={28} strokeWidth={2.2} color={name === 'learn' ? colors.primaryDark : colors.muted} /></View>
      <AppText style={styles.label} color={name === 'learn' ? colors.primaryDark : colors.muted}>{label}</AppText>
    </Pressable>)}
  </View>;
}
const styles = StyleSheet.create({
  bar: { flexDirection: 'row', paddingTop: 8, paddingHorizontal: 8, backgroundColor: colors.surface, borderTopLeftRadius: 36, borderTopRightRadius: 36, ...shadows.navigation },
  item: { flex: 1, minWidth: 0, height: 74, alignItems: 'center', justifyContent: 'center', gap: 2 },
  icon: { width: 60, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  active: { backgroundColor: colors.primarySoft },
  label: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 18 },
  pressed: { opacity: 0.7 },
});
