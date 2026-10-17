import { useCallback, useRef, useState } from 'react';
import { BackHandler } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { CircleCheck, Trash2 } from 'lucide-react-native';
import { Screen } from '@/components/common/Screen';
import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Notice } from '@/components/common/Notice';
import { clearDeletionNotice, deleteAccount, getDeletionNotice } from '@/services/accountDeletion';
import { colors } from '@/constants/theme';

export default function AccountDeleted() {
  const [notice, setNotice] = useState(getDeletionNotice);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const lock = useRef(false);
  useFocusEffect(
    useCallback(() => {
      const listener = BackHandler.addEventListener('hardwareBackPress', () => !!notice);
      return () => listener.remove();
    }, [notice]),
  );
  async function finishCleanup() {
    if (!notice || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(false);
    try {
      await deleteAccount(notice.userId, '');
      setNotice(getDeletionNotice());
    } catch {
      setError(true);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (!notice)
    return (
      <Screen>
        <AppText accessibilityRole="header" variant="h2">
          Nenhuma exclusão confirmada
        </AppText>
        <AppText>
          Nesta sessão não há uma confirmação de exclusão. Consulte o suporte se estiver em dúvida sobre um
          pedido anterior.
        </AppText>
        <Button title="Voltar" onPress={() => router.replace('/account/delete')} />
      </Screen>
    );
  return (
    <Screen
      footer={
        <>
          {!notice.result.cleanupComplete ? (
            <Button
              title="Finalizar limpeza neste aparelho"
              icon={Trash2}
              loading={busy}
              onPress={() => void finishCleanup()}
            />
          ) : null}
          <Button
            title="Continuar"
            disabled={busy || !notice.result.cleanupComplete}
            onPress={() => {
              clearDeletionNotice();
              router.replace('/');
            }}
          />
        </>
      }
    >
      <CircleCheck size={48} color={colors.success} />
      <AppText accessibilityRole="header" variant="h2">
        Conta excluída
      </AppText>
      <AppText>
        Sua conta e os dados associados foram removidos do Arca. Essa ação não pode ser desfeita.
      </AppText>
      {!notice.result.cleanupComplete ? (
        <Notice
          tone="error"
          message="A conta foi excluída no servidor, mas não foi possível concluir a limpeza neste aparelho. Toque em Finalizar limpeza ou limpe os dados do app nas configurações do Android."
        />
      ) : (
        <AppText color={colors.muted}>
          A sessão, o cache e as conquistas desta conta também foram removidos deste aparelho.
        </AppText>
      )}
      {error ? (
        <Notice
          tone="error"
          message="Não foi possível finalizar a limpeza. Tente novamente ou limpe os dados do aplicativo nas configurações do Android."
        />
      ) : null}
    </Screen>
  );
}
