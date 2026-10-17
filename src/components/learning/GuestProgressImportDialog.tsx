import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { BookOpen, CloudUpload, Sparkles } from 'lucide-react-native';
import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Notice } from '@/components/common/Notice';
import { colors, spacing } from '@/constants/theme';

export function GuestProgressImportDialog({
  xp,
  lessons,
  hasAccount,
  unavailable,
  loading,
  onImport,
  onDismiss,
  onAuthenticate,
}: {
  xp: number;
  lessons: number;
  hasAccount: boolean;
  unavailable: boolean;
  loading: boolean;
  onImport: () => Promise<void>;
  onDismiss: () => void;
  onAuthenticate: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  async function save() {
    if (!hasAccount) {
      onAuthenticate();
      router.push('/(auth)/signup');
      return;
    }
    setError(null);
    try {
      await onImport();
      onDismiss();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível importar agora. Seu progresso continua guardado.',
      );
    }
  }
  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!loading) onDismiss();
      }}
    >
      <View style={styles.overlay}>
        <View accessibilityViewIsModal style={styles.dialog}>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.symbol}>
              <CloudUpload size={24} color={colors.primaryDark} />
            </View>
            <AppText variant="h3">Encontramos progresso neste aparelho</AppText>
            <View style={styles.stats}>
              <View style={styles.stat}>
                <Sparkles size={20} color={colors.gold} />
                <AppText variant="h2">{xp}</AppText>
                <AppText variant="small" color={colors.muted}>
                  XP local
                </AppText>
              </View>
              <View style={styles.stat}>
                <BookOpen size={20} color={colors.primary} />
                <AppText variant="h2">{lessons}</AppText>
                <AppText variant="small" color={colors.muted}>
                  Lições concluídas
                </AppText>
              </View>
            </View>
            {!hasAccount ? (
              <AppText variant="small" color={colors.muted}>
                Crie uma conta ou entre para importar. Seu progresso continua guardado neste aparelho.
              </AppText>
            ) : null}
            {unavailable ? (
              <Notice message="Conecte-se e conclua a sincronização para importar. Seus dados continuam guardados." />
            ) : null}
            {error ? <Notice tone="error" message={error} /> : null}
            <Button
              title="Importar progresso"
              style={styles.importButton}
              icon={CloudUpload}
              loading={loading}
              disabled={unavailable}
              onPress={() => void save()}
            />
            <Button
              title="Agora não"
              style={styles.dismissButton}
              variant="quiet"
              disabled={loading}
              onPress={onDismiss}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(34,33,42,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  dialog: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '90%',
    backgroundColor: colors.surface,
    borderRadius: 8,
  },
  content: { padding: spacing.md, gap: spacing.sm },
  symbol: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, alignItems: 'center', gap: spacing.xxs },
  importButton: { paddingHorizontal: spacing.md },
  dismissButton: { minHeight: 44, paddingVertical: spacing.xs },
});
