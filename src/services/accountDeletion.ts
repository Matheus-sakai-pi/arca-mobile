import { accountStorage } from '@/lib/accountStorage';
import { requireSupabase } from '@/lib/supabase';
import { sessionStorage } from '@/lib/sessionStorage';
import { detachDevicePush } from './pushNotifications';

export type DeletionResult = { deleted: true; cleanupComplete: boolean };
const confirmed = new Set<string>();
let notice: { userId: string; result: DeletionResult } | null = null;
export const getDeletionNotice = () => notice;
export function clearDeletionNotice() { notice = null; }
export async function deleteAccount(userId: string, password: string): Promise<DeletionResult> {
  const client = requireSupabase();
  if (!confirmed.has(userId)) {
    const { data, error } = await client.auth.getSession();
    if (error || data.session?.user.id !== userId) throw new Error('account_changed');
    if (!password || password.length > 128) throw new Error('password_required');
    await accountStorage.pauseUser(userId);
    try {
      const response = await client.functions.invoke('delete-account', {
        headers: { Authorization: `Bearer ${data.session.access_token}` }, body: { password },
      });
      if (response.error) {
        let code = 'deletion_unavailable';
        if (response.error.context instanceof Response) {
          const body: unknown = await response.error.context.json().catch(() => null);
          if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') code = body.error;
        }
        throw new Error(code);
      }
      if (response.data?.deleted !== true || response.data?.userId !== userId) throw new Error('deletion_unconfirmed');
      confirmed.add(userId);
    } catch (error) { accountStorage.resumeUser(userId); throw error; }
  }
  let cleanupComplete = true;
  try { await accountStorage.clearUser(userId); } catch { cleanupComplete = false; }
  // A late deletion response must never sign out a different account.
  try {
    const { data } = await client.auth.getSession();
    if (data.session?.user.id === userId) {
      try { await detachDevicePush(userId); } catch { cleanupComplete = false; }
      const { error } = await client.auth.signOut({ scope: 'local' });
      const after = await client.auth.getSession();
      if (after.data.session?.user.id === userId) cleanupComplete = false;
      if (error && after.data.session) cleanupComplete = false;
      await sessionStorage.removeItem('arca.recovery');
    }
  } catch { cleanupComplete = false; }
  const result: DeletionResult = { deleted: true, cleanupComplete };
  notice = { userId, result };
  return result;
}
export function deletionErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  const messages: Record<string, string> = {
    account_changed: 'Sua sessão mudou. Entre novamente na conta que deseja excluir.',
    password_required: 'Digite sua senha atual.',
    invalid_credentials: 'Senha incorreta. Sua conta não foi excluída.',
    auth_required: 'Sua sessão expirou. Entre novamente para excluir a conta.',
    rate_limited: 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.',
    deletion_failed: 'Não foi possível excluir a conta. Tente novamente ou entre em contato com o suporte.',
    deletion_unconfirmed: 'Não foi possível confirmar a exclusão. Entre em contato com o suporte antes de tentar novamente.',
  };
  return messages[code] ?? 'Não foi possível confirmar a exclusão. Confira sua conexão e tente novamente. Você também pode solicitar a exclusão ao suporte.';
}
