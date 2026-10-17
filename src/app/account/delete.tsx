import { useCallback, useRef, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as Linking from 'expo-linking';
import { ArrowLeft, Check, LockKeyhole, Mail, Square, Trash2 } from 'lucide-react-native';
import { Screen } from '@/components/common/Screen';
import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { IconButton } from '@/components/common/IconButton';
import { Field } from '@/components/common/Field';
import { Notice } from '@/components/common/Notice';
import { useAuth } from '@/hooks/useAuth';
import { privacyContact, deletionRequestUrl } from '@/constants/privacy';
import { deleteAccount, deletionErrorMessage } from '@/services/accountDeletion';
import { requestPasswordReset } from '@/services/auth';
import { authErrorMessage } from '@/services/validation';
import { colors, spacing } from '@/constants/theme';

export default function DeleteAccount() {
  const { session } = useAuth();
  const [password, setPassword] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const owner = useRef<string | null>(null);
  const lock = useRef(false);
  useFocusEffect(useCallback(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => lock.current);
    return () => listener.remove();
  }, []));
  async function remove() {
    if (lock.current || !session || !password || !acknowledged) return;
    owner.current ??= session?.user.id ?? null;
    if (!owner.current) return;
    lock.current = true; setBusy(true); setError(null);
    try { await deleteAccount(owner.current, password); setPassword(''); router.replace('/account/deleted'); }
    catch (caught) { setError(deletionErrorMessage(caught)); setPassword(''); }
    finally { lock.current = false; setBusy(false); }
  }
  async function request() {
    try { await Linking.openURL(deletionRequestUrl(session?.user.email)); }
    catch { setError(`Envie seu pedido para ${privacyContact.email}, com o e-mail usado no cadastro. Não envie sua senha.`); }
  }
  async function recover() {
    if (!session?.user.email || lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    try { await requestPasswordReset(session.user.email); setResetSent(true); }
    catch (caught) { setError(authErrorMessage(caught)); }
    finally { lock.current = false; setBusy(false); }
  }
  return <Screen keyboard footer={session ? <Button title="Excluir minha conta" icon={Trash2} loading={busy} disabled={!acknowledged || !password} onPress={() => void remove()} /> : undefined}>
    <View style={styles.heading}><IconButton icon={ArrowLeft} label="Voltar" disabled={busy} onPress={() => router.canGoBack() ? router.back() : router.replace('/')} /><AppText accessibilityRole="header" variant="h2" style={styles.title}>Excluir conta</AppText></View>
      <AppText>Serão excluídos seu perfil, lições concluídas, respostas, XP, sequência, registros de atividade e importações de progresso. Sua conta também sairá do ranking.</AppText>
      <AppText color={colors.muted}>As conquistas e o cache desta conta serão removidos deste aparelho. O progresso de visitante e as preferências gerais não serão apagados. Cópias offline em outros aparelhos precisam ser limpas nesses aparelhos.</AppText>
      {session ? <><AppText selectable>{session.user.email}</AppText><Notice tone="error" message="A exclusão é permanente. Você não poderá recuperar esta conta ou seu progresso." />
        <Field label="Senha atual" icon={LockKeyhole} password autoCapitalize="none" autoCorrect={false} autoComplete="current-password" value={password} onChangeText={setPassword} maxLength={128} editable={!busy} />
        <Pressable accessibilityRole="checkbox" accessibilityLabel="Entendo que a exclusão é permanente" accessibilityState={{ checked: acknowledged, disabled: busy }} disabled={busy} onPress={() => setAcknowledged(value => !value)} style={styles.acknowledge}>{acknowledged ? <Check size={24} color={colors.primary} /> : <Square size={24} color={colors.muted} />}<AppText style={styles.title}>Entendo que a exclusão é permanente.</AppText></Pressable>
        <Button title="Esqueci minha senha" variant="quiet" disabled={busy || resetSent} onPress={() => void recover()} />
        {resetSent ? <Notice tone="success" message="Confira seu e-mail para recuperar a senha antes de excluir a conta." /> : null}
      </> : <AppText>Você pode solicitar a exclusão por e-mail sem instalar ou entrar no app. Identificaremos sua conta e confirmaremos a titularidade antes de excluir os dados.</AppText>}
      <Button title="Solicitar exclusão por e-mail" icon={Mail} variant="secondary" disabled={busy} onPress={() => void request()} />
      <AppText selectable variant="small" color={colors.muted}>{privacyContact.email} · Não envie sua senha ao suporte.</AppText>
      <Button title="Política de Privacidade" variant="quiet" disabled={busy} onPress={() => router.push('/privacy')} />
    {error ? <Notice tone="error" message={error} /> : null}
  </Screen>;
}
const styles = StyleSheet.create({ heading: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }, title: { flex: 1 }, acknowledge: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 56 } });
