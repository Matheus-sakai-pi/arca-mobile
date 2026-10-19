import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ban, Flag, X } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { signedPhoto, photoSafety } from '@/services/profilePhoto';
import { getAvatarSource } from '@/constants/avatars';
import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { IconButton } from '@/components/common/IconButton';
import { Notice } from '@/components/common/Notice';

export function PhotoAvatar({ id, size, label }: { id: string; size: number; label?: string }) {
  const { session } = useAuth();
  const owner = session?.user.id;
  const [photo, setPhoto] = useState<{ owner: string; id: string; uri: string; userId: string } | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!owner) return;
    let alive = true,
      busy = false;
    const refresh = async () => {
      if (busy) return;
      busy = true;
      try {
        const next = await signedPhoto(owner, id);
        if (alive) setPhoto(next ? { ...next, owner, id } : null);
      } catch {
        if (alive) setPhoto(null);
      } finally {
        busy = false;
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 45000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [owner, id]);
  const current = photo?.owner === owner && photo?.id === id ? photo : null;
  const image = (
    <Image
      source={current ? { uri: current.uri } : getAvatarSource(null)}
      resizeMode="cover"
      accessibilityLabel={label}
      accessible={!!label}
      onError={() => setPhoto(null)}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#EDF2FF' }}
    />
  );
  return (
    <>
      {current && current.userId !== owner ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Opções da foto${label ? ` de ${label}` : ''}`}
          onPress={() => setOpen(true)}
        >
          {image}
        </Pressable>
      ) : (
        image
      )}
      {open && owner ? (
        <PhotoSafetyDialog
          owner={owner}
          id={id}
          onClose={() => setOpen(false)}
          onBlocked={() => setPhoto(null)}
        />
      ) : null}
    </>
  );
}
function PhotoSafetyDialog({
  owner,
  id,
  onClose,
  onBlocked,
}: {
  owner: string;
  id: string;
  onClose: () => void;
  onBlocked: () => void;
}) {
  const [reason, setReason] = useState('sexual'),
    [busy, setBusy] = useState(false),
    [confirmBlock, setConfirmBlock] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; message: string } | null>(null);
  async function act(action: 'report' | 'block') {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      await photoSafety(owner, id, action, reason);
      if (action === 'block') onBlocked();
      setNotice({
        tone: 'success',
        message:
          action === 'report'
            ? 'Denúncia enviada para análise.'
            : 'Usuário bloqueado. Você pode desbloqueá-lo em Perfil > Foto de perfil.',
      });
    } catch (cause) {
      setNotice({
        tone: 'error',
        message: cause instanceof Error ? cause.message : 'Não foi possível concluir.',
      });
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <SafeAreaView style={styles.overlay}>
        <View style={styles.dialog} accessibilityViewIsModal>
          <View style={styles.header}>
            <AppText variant="h3" style={styles.title}>
              Foto de perfil
            </AppText>
            <IconButton icon={X} label="Fechar opções da foto" onPress={onClose} disabled={busy} />
          </View>
          <ScrollView contentContainerStyle={styles.content}>
            <AppText variant="label">Denunciar foto</AppText>
            <View accessibilityRole="radiogroup" accessibilityLabel="Motivo da denúncia">
              {[
                ['sexual', 'Nudez ou conteúdo sexual'],
                ['violence', 'Violência gráfica'],
                ['privacy', 'Uso indevido de imagem'],
                ['other', 'Outro conteúdo inadequado'],
              ].map(([key, text]) => (
                <Pressable
                  key={key}
                  accessibilityRole="radio"
                  accessibilityLabel={text}
                  accessibilityState={{ checked: reason === key }}
                  aria-checked={reason === key}
                  disabled={busy}
                  onPress={() => setReason(key!)}
                  style={[styles.reason, reason === key && styles.selected]}
                >
                  <AppText>{text}</AppText>
                </Pressable>
              ))}
            </View>
            <Button title="Enviar denúncia" icon={Flag} disabled={busy} onPress={() => void act('report')} />
            {confirmBlock ? (
              <>
                <Notice message="Bloquear oculta as fotos dessa pessoa, remove a amizade e impede novos pedidos e desafios entre vocês." />
                <Button
                  title="Confirmar bloqueio"
                  icon={Ban}
                  disabled={busy}
                  onPress={() => void act('block')}
                />
                <Button
                  title="Cancelar bloqueio"
                  variant="quiet"
                  disabled={busy}
                  onPress={() => setConfirmBlock(false)}
                />
              </>
            ) : (
              <Button
                title="Bloquear usuário"
                icon={Ban}
                variant="quiet"
                disabled={busy}
                onPress={() => setConfirmBlock(true)}
              />
            )}
            {notice ? <Notice {...notice} /> : null}
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,28,43,0.5)',
  },
  dialog: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '94%',
    padding: 16,
    borderRadius: 8,
    backgroundColor: 'white',
  },
  header: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  title: { flex: 1 },
  content: { gap: 14, paddingVertical: 12 },
  reason: { minHeight: 48, padding: 12, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  selected: { backgroundColor: '#E9F1FF' },
});
