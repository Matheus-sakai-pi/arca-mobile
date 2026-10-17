import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { usePathname } from 'expo-router';
import { useLearning } from '@/providers/LearningProvider';
import { useAuth } from '@/hooks/useAuth';
import { useMotionPreference } from '@/hooks/useMotionPreference';
import { hasChosenUsername } from '@/lib/username';
import { AppText } from '@/components/common/AppText';
import { UsernameForm } from './UsernameForm';
import { colors } from '@/constants/theme';

export function UsernamePrompt() {
  const { session, isRecovery } = useAuth();
  return session && !isRecovery ? <AccountUsernamePrompt key={session.user.id} /> : null;
}
function AccountUsernamePrompt() {
  const { profile, offline, loading, activeLessonId } = useLearning();
  const pathname = usePathname();
  const reduced = useMotionPreference();
  const [dismissed, setDismissed] = useState(false);
  const close = () => setDismissed(true);
  if (
    !profile ||
    hasChosenUsername(profile) ||
    loading ||
    offline ||
    activeLessonId ||
    dismissed ||
    !['/home', '/learn', '/ranking', '/profile', '/friends'].includes(pathname)
  )
    return null;
  return (
    <Modal visible transparent animationType={reduced ? 'none' : 'fade'} onRequestClose={close}>
      <ScrollView
        style={styles.overlay}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View accessibilityViewIsModal style={styles.dialog}>
          <AppText variant="h2" accessibilityRole="header">
            Escolha seu nome de usuário
          </AppText>
          <AppText color={colors.muted}>Seu progresso e suas amizades continuam guardados.</AppText>
          <UsernameForm onDone={close} onCancel={close} cancelLabel="Escolher depois" />
        </View>
      </ScrollView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(34,33,42,0.45)' },
  content: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  dialog: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 24,
    gap: 12,
  },
});
