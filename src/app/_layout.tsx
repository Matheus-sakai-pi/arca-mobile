import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Nunito_400Regular } from '@expo-google-fonts/nunito/400Regular';
import { Nunito_600SemiBold } from '@expo-google-fonts/nunito/600SemiBold';
import { Nunito_700Bold } from '@expo-google-fonts/nunito/700Bold';
import { Nunito_800ExtraBold } from '@expo-google-fonts/nunito/800ExtraBold';
import { AuthProvider } from '@/providers/AuthProvider';
import { OnboardingProvider } from '@/providers/OnboardingProvider';
import { LearningProvider } from '@/providers/LearningProvider';
import { PreferencesProvider } from '@/providers/PreferencesProvider';
import { RewardMotionProvider } from '@/providers/RewardMotionProvider';
import { StudyProvider } from '@/providers/StudyProvider';
import { EnergyProvider } from '@/providers/EnergyProvider';
import { MembershipProvider } from '@/providers/MembershipProvider';
import { BillingLifecycle } from '@/components/membership/BillingLifecycle';
import { VipWelcome } from '@/components/membership/VipWelcome';
import { AppErrorBoundary } from '@/components/common/AppErrorBoundary';
import { AchievementCelebration } from '@/components/animation/AchievementCelebration';
import { UsernamePrompt } from '@/components/profile/UsernamePrompt';
import { PushLifecycle } from '@/components/learning/PushLifecycle';
import { useAuth } from '@/hooks/useAuth';
import { useOnboarding } from '@/hooks/useOnboarding';
import { ErrorState, LoadingState } from '@/components/common/States';
import { Button } from '@/components/common/Button';
import { colors, layout, spacing } from '@/constants/theme';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function Navigator({ fontsReady }: { fontsReady: boolean }) {
  const { session, isGuest, loading, error, isRecovery, retry, enterGuest } = useAuth();
  const onboarding = useOnboarding();
  const pathname = usePathname();
  const publicLegal = pathname === '/privacy' || pathname === '/account/delete' || pathname === '/account/deleted' || pathname === '/support';
  const ready = fontsReady && (!loading || publicLegal) && !onboarding.loading;
  useEffect(() => { if (ready) void SplashScreen.hideAsync().catch(() => undefined); }, [ready]);
  if (!ready) return <LoadingState message={loading ? 'Verificando sua sessão...' : 'Preparando sua jornada...'} />;
  if (error && !publicLegal) return <View style={styles.error}><ErrorState message={error} onRetry={retry} /><Button title="Continuar sem conta" variant="quiet" onPress={enterGuest} /><Button title="Política de Privacidade" variant="quiet" onPress={() => router.push('/privacy')} /></View>;
  return (
    <><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={!session}>
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={(!!session || isGuest) && !isRecovery}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="unit/[id]" />
        <Stack.Screen name="lesson/[id]" options={{ gestureEnabled: false }} />
        <Stack.Screen name="lesson/result" options={{ gestureEnabled: false }} />
        <Stack.Screen name="study/history" />
        <Stack.Screen name="study/review" />
        <Stack.Screen name="study/weekly" />
        <Stack.Screen name="study/reminders" />
        <Stack.Screen name="challenges" />
        <Stack.Screen name="challenges/[id]" options={{ gestureEnabled: false }} />
        <Stack.Screen name="vip" />
        <Stack.Screen name="invite" />
      </Stack.Protected>
      <Stack.Screen name="auth/callback" />
      <Stack.Screen name="auth/reset-password" />
      <Stack.Screen name="privacy" />
      <Stack.Screen name="support" />
      <Stack.Screen name="account/delete" options={{ gestureEnabled: false }} />
      <Stack.Screen name="account/deleted" options={{ gestureEnabled: false }} />
      <Stack.Screen name="+not-found" />
    </Stack><AchievementCelebration /><UsernamePrompt /><PushLifecycle /><BillingLifecycle /><VipWelcome /></>
  );
}
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold });
  return <SafeAreaProvider><AppErrorBoundary><AuthProvider><PreferencesProvider><OnboardingProvider><LearningProvider><EnergyProvider><MembershipProvider><StudyProvider><RewardMotionProvider><View style={styles.outer}><View style={styles.app}><StatusBar style="dark" /><Navigator fontsReady={fontsLoaded || !!fontError} /></View></View></RewardMotionProvider></StudyProvider></MembershipProvider></EnergyProvider></LearningProvider></OnboardingProvider></PreferencesProvider></AuthProvider></AppErrorBoundary></SafeAreaProvider>;
}
const styles = StyleSheet.create({ outer: { flex: 1, backgroundColor: colors.background }, app: { flex: 1, width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center' }, error: { flex: 1, justifyContent: 'center', padding: spacing.lg } });
