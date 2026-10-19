import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Modal, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, RefreshCw, Send, Trash2, X } from 'lucide-react-native';
import { router } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Checkbox } from '@/components/common/Checkbox';
import { IconButton } from '@/components/common/IconButton';
import { Notice } from '@/components/common/Notice';
import { pickProfilePhoto } from '@/services/pickProfilePhoto';
import { photoBlocks, signedPhoto, syncProfilePhoto, uploadProfilePhoto } from '@/services/profilePhoto';
import { photoAvatarId, type PhotoStatus } from '@/lib/profilePhoto';
import { Avatar } from './Avatar';

const statusText = {
  uploading: 'Envio em andamento',
  pending: 'Foto aguardando aprovação',
  approved: 'Foto aprovada',
  rejected: 'Foto não aprovada',
  removed: 'Foto removida',
  cancelled: 'Envio cancelado',
  superseded: 'Foto substituída',
};
export function ProfilePhotoPicker({
  owner,
  avatarKey,
  onClose,
  onChanged,
}: {
  owner: string;
  avatarKey: string;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [status, setStatus] = useState<PhotoStatus | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [selection, setSelection] = useState<{ id: string; image: string; uri: string } | null>(null);
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null),
    [notice, setNotice] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<{ id: string; name: string }[]>([]);
  const alive = useRef(true),
    generation = useRef(0),
    running = useRef(false);
  const read = useCallback(async () => {
    const next = await syncProfilePhoto(owner);
    const blocked = await photoBlocks(owner);
    const photo = next.latest ? await signedPhoto(owner, next.latest.id, true).catch(() => null) : null;
    return { next, blocked, photo };
  }, [owner]);
  const refresh = useCallback(async () => {
    const version = ++generation.current;
    setLoading(true);
    setError(null);
    try {
      const { next, blocked, photo } = await read();
      if (alive.current && version === generation.current) {
        setStatus(next);
        setPreview(photo?.uri ?? null);
        setBlocks(blocked);
      }
    } catch (cause) {
      if (alive.current && version === generation.current)
        setError(cause instanceof Error ? cause.message : 'Não foi possível carregar sua foto.');
    } finally {
      if (alive.current && version === generation.current) setLoading(false);
    }
  }, [read]);
  useEffect(() => {
    alive.current = true;
    const version = ++generation.current;
    void read()
      .then(({ next, blocked, photo }) => {
        if (alive.current && version === generation.current) {
          setStatus(next);
          setBlocks(blocked);
          setPreview(photo?.uri ?? null);
        }
      })
      .catch(cause => {
        if (alive.current && version === generation.current)
          setError(cause instanceof Error ? cause.message : 'Não foi possível carregar sua foto.');
      })
      .finally(() => {
        if (alive.current && version === generation.current) setLoading(false);
      });
    return () => {
      alive.current = false;
    };
  }, [read]);
  const pending = status?.latest && ['uploading', 'pending'].includes(status.latest.state);
  async function run(action: () => Promise<void>) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (cause) {
      if (alive.current) setError(cause instanceof Error ? cause.message : 'Não foi possível concluir.');
    } finally {
      running.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function choose() {
    const picked = await pickProfilePhoto();
    if (picked && alive.current) {
      setSelection({ ...picked, id: Crypto.randomUUID() });
      setConsent(false);
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
            <IconButton icon={X} label="Fechar foto de perfil" disabled={busy} onPress={onClose} />
          </View>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.preview}>
              {selection?.uri || preview ? (
                <Image
                  source={{ uri: selection?.uri ?? preview! }}
                  style={styles.photo}
                  accessibilityLabel="Prévia privada da foto"
                />
              ) : (
                <Avatar avatarKey={avatarKey} size={120} />
              )}
            </View>
            {status?.latest ? (
              <AppText variant="label" style={styles.center}>
                {statusText[status.latest.state]}
              </AppText>
            ) : null}
            {status?.latest?.reason ? <Notice message={status.latest.reason} /> : null}
            {pending ? (
              <Notice message="Sua foto só aparecerá para outras pessoas depois da aprovação. O avatar atual continua visível enquanto isso." />
            ) : null}
            {status?.restricted ? (
              <Notice
                tone="error"
                message="Novos envios estão suspensos para esta conta. Entre em contato com o suporte."
              />
            ) : null}
            {loading ? <AppText style={styles.center}>Conferindo sua foto…</AppText> : null}
            {status && !status.vip ? (
              <Button
                title="Conhecer Arca VIP"
                onPress={() => {
                  onClose();
                  router.push('/vip');
                }}
              />
            ) : null}
            {status?.vip && !status.restricted && !pending ? (
              <>
                <Button
                  title={selection ? 'Escolher outra foto' : 'Escolher foto'}
                  icon={Camera}
                  variant="secondary"
                  disabled={busy || loading}
                  onPress={() => void run(choose)}
                />
                {selection ? (
                  <>
                    <AppText variant="small">
                      Não envie nudez, conteúdo sexual, violência gráfica, discurso de ódio ou fotos que
                      exponham terceiros sem autorização. Os envios passam por aprovação manual e violações
                      podem suspender novos envios.
                    </AppText>
                    <Checkbox
                      label="Tenho direito de usar esta foto e aceito as regras de envio."
                      checked={consent}
                      onChange={value => {
                        if (!busy) setConsent(value);
                      }}
                    />
                  </>
                ) : null}
              </>
            ) : null}
            {pending ? (
              <Button
                title="Cancelar envio"
                icon={X}
                variant="quiet"
                disabled={busy || loading}
                onPress={() =>
                  void run(async () => {
                    await syncProfilePhoto(owner, 'cancel', status!.latest!.id);
                    setSelection(null);
                    await refresh();
                  })
                }
              />
            ) : null}
            {photoAvatarId(avatarKey) ? (
              <Button
                title="Remover minha foto"
                icon={Trash2}
                variant="quiet"
                disabled={busy || loading}
                onPress={() =>
                  void run(async () => {
                    await syncProfilePhoto(owner, 'remove', photoAvatarId(avatarKey)!);
                    setSelection(null);
                    await refresh();
                    await onChanged();
                  })
                }
              />
            ) : null}
            <Button
              title="Atualizar status da foto"
              icon={RefreshCw}
              variant="quiet"
              disabled={busy || loading}
              onPress={() =>
                void run(async () => {
                  await refresh();
                  await onChanged();
                })
              }
            />
            {blocks.length ? (
              <View style={styles.blocks}>
                <AppText variant="label">Usuários bloqueados</AppText>
                {blocks.map(person => (
                  <View key={person.id} style={styles.block}>
                    <AppText style={styles.title}>{person.name}</AppText>
                    <Button
                      title="Desbloquear"
                      variant="quiet"
                      disabled={busy}
                      onPress={() =>
                        void run(async () => {
                          const next = await photoBlocks(owner, person.id);
                          if (alive.current) setBlocks(next);
                        })
                      }
                    />
                  </View>
                ))}
              </View>
            ) : null}
            {notice ? <Notice tone="success" message={notice} /> : null}
            {error ? <Notice tone="error" message={error} /> : null}
          </ScrollView>
          {selection && status?.vip && !pending && !status.restricted ? (
            <Button
              title="Enviar para aprovação"
              icon={Send}
              disabled={!consent || loading}
              loading={busy}
              onPress={() =>
                void run(async () => {
                  await uploadProfilePhoto(owner, selection.id, selection.image);
                  if (alive.current) {
                    setSelection(null);
                    setConsent(false);
                  }
                  await refresh();
                  if (alive.current) setNotice('Foto enviada para aprovação.');
                })
              }
            />
          ) : null}
        </View>
      </SafeAreaView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    padding: 16,
    backgroundColor: 'rgba(20,28,43,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialog: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '94%',
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 8,
    gap: 12,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1 },
  content: { gap: 14, paddingVertical: 8 },
  preview: { alignItems: 'center', minHeight: 120 },
  photo: { width: 120, height: 120, borderRadius: 60 },
  center: { textAlign: 'center' },
  blocks: { gap: 8, borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 12 },
  block: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
