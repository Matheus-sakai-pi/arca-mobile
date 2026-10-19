import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, ArrowRight, AtSign, LockKeyhole, Mail } from '@/components/icons';
import { Screen } from '@/components/common/Screen';
import { AppText } from '@/components/common/AppText';
import { Brand } from '@/components/common/Brand';
import { Button } from '@/components/common/Button';
import { IconButton } from '@/components/common/IconButton';
import { Field } from '@/components/common/Field';
import { Notice } from '@/components/common/Notice';
import { Mascot } from '@/components/mascot/Mascot';
import { useAuth } from '@/hooks/useAuth';
import { useLearning } from '@/providers/LearningProvider';
import { useOnboarding } from '@/hooks/useOnboarding';
import { isSupabaseConfigured } from '@/lib/supabase';
import { requestPasswordReset, signIn, signUp, updatePassword } from '@/services/auth';
import { authErrorMessage, validateAuth, type AuthFieldErrors, type AuthFormMode, type AuthValues } from '@/services/validation';
import { colors, spacing } from '@/constants/theme';
import { installedReferral } from '@/services/referralDevice';
import { referralCode } from '@/lib/membership';
import { Checkbox } from '@/components/common/Checkbox';

const copy = {
  login: { title: 'Que bom ter você\nde volta.', description: 'Entre para continuar sua jornada.', action: 'Entrar' },
  signup: { title: 'Sua jornada\ncomeça aqui.', description: 'Um novo começo, uma lição por vez.', action: 'Criar minha conta' },
  forgot: { title: 'Vamos recuperar\nsua conta.', description: 'Enviaremos um link para criar uma nova senha.', action: 'Enviar link' },
  reset: { title: 'Um novo começo\npara sua senha.', description: 'Escolha uma senha segura para sua conta.', action: 'Salvar nova senha' },
} as const;

export function AuthForm({ mode }: { mode: AuthFormMode }) {
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmationRef = useRef<TextInput>(null);
  const [values, setValues] = useState<AuthValues>({ name: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState<AuthFieldErrors>({});
  const [notice, setNotice] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [invite, setInvite] = useState(''), [inviteConsent, setInviteConsent] = useState(false);
  useEffect(() => { let active = true; if (mode === 'signup') void installedReferral().then(code => { if (active) setInvite(value => value || code); }); return () => { active = false; }; }, [mode]);
  const { enterGuest, setRecovery } = useAuth();
  const { requestGuestImport } = useLearning();
  const { complete } = useOnboarding();
  const text = copy[mode];
  function change(field: keyof AuthValues, value: string) {
    setValues(current => ({ ...current, [field]: value }));
    setErrors(current => ({ ...current, [field]: undefined }));
    setNotice(null);
  }
  async function submit() {
    if (busy) return;
    const nextErrors = validateAuth(mode, values);
    setErrors(nextErrors);
    setNotice(null);
    if (Object.keys(nextErrors).length) return;
    if (mode === 'signup' && invite.trim() && (!referralCode(invite) || !inviteConsent)) {
      setNotice({ tone: 'error', message: !referralCode(invite) ? 'Confira o código do convite: são 16 letras e números.' : 'Aceite o convite para adicionar essa pessoa como amiga ou remova o código.' }); return;
    }
    setBusy(true);
    if (mode === 'login' || mode === 'signup') requestGuestImport(true);
    try {
      if (mode === 'login') { await signIn(values.email, values.password); await complete(); }
      if (mode === 'signup') {
        const result = await signUp(values.name, values.email, values.password, inviteConsent ? invite : '');
        await complete();
        if (!result.session) router.replace({ pathname: '/(auth)/confirm-email', params: { email: values.email.trim().toLowerCase() } });
      }
      if (mode === 'forgot') {
        await requestPasswordReset(values.email);
        setSent(true);
        setNotice({ tone: 'success', message: 'Se houver uma conta com este e-mail, você receberá um link para redefinir a senha. Confira também a caixa de spam.' });
      }
      if (mode === 'reset') {
        await updatePassword(values.password);
        setRecovery(false);
        router.replace('/(tabs)/home');
      }
    } catch (error) { setNotice({ tone: 'error', message: authErrorMessage(error) }); }
    finally { setBusy(false); }
  }
  async function visit() { await complete(); enterGuest(); router.replace('/(tabs)/home'); }
  function back() {
    if (mode === 'reset') { setRecovery(false); router.replace('/(tabs)/profile'); return; }
    if (router.canGoBack()) router.back(); else router.replace('/(auth)/login');
  }
  return (
    <Screen keyboard footer={<>
      <Button title={sent ? 'Voltar para entrar' : text.action} icon={ArrowRight} loading={busy} onPress={() => sent ? router.replace('/(auth)/login') : void submit()} />
      {mode === 'login' ? <Button title="Ainda não tenho conta" variant="quiet" onPress={() => router.replace('/(auth)/signup')} /> : mode === 'signup' ? <Button title="Já tenho uma conta" variant="quiet" onPress={() => router.replace('/(auth)/login')} /> : null}
    </>}>
      <View style={styles.header}><IconButton icon={ArrowLeft} label="Voltar" onPress={back} /><Brand compact /></View>
      <View style={styles.intro}><View style={styles.copy}><AppText accessibilityRole="header" variant="h2">{text.title}</AppText><AppText variant="small" color={colors.muted}>{text.description}</AppText></View><Mascot size={104} /></View>
      {!isSupabaseConfigured && mode !== 'reset' && !notice ? <Notice message="As contas ainda não estão disponíveis. Você pode conhecer o Arca sem entrar." /> : null}
      {notice ? <Notice {...notice} /> : null}
      {!sent ? <View style={styles.form}>
        {mode === 'signup' ? <Field label="Nome de usuário" icon={AtSign} placeholder="seu_usuario" value={values.name} onChangeText={value => change('name', value)} error={errors.name} autoCapitalize="none" autoCorrect={false} autoComplete="username-new" textContentType="username" maxLength={31} editable={!busy} returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => emailRef.current?.focus()} /> : null}
        {mode !== 'reset' ? <Field inputRef={emailRef} label="E-mail" icon={Mail} placeholder="voce@exemplo.com" value={values.email} onChangeText={value => change('email', value)} error={errors.email} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" maxLength={254} editable={!busy} returnKeyType={mode === 'forgot' ? 'go' : 'next'} submitBehavior="submit" onSubmitEditing={mode === 'forgot' ? () => void submit() : () => passwordRef.current?.focus()} /> : null}
        {mode !== 'forgot' ? <Field inputRef={passwordRef} label="Senha" icon={LockKeyhole} placeholder={mode === 'login' ? 'Sua senha' : 'Pelo menos 8 caracteres'} password value={values.password} onChangeText={value => change('password', value)} error={errors.password} autoCapitalize="none" autoCorrect={false} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} textContentType={mode === 'login' ? 'password' : 'newPassword'} maxLength={128} editable={!busy} returnKeyType={mode === 'login' ? 'go' : 'next'} submitBehavior="submit" onSubmitEditing={mode === 'login' ? () => void submit() : () => confirmationRef.current?.focus()} /> : null}
        {mode === 'signup' || mode === 'reset' ? <Field inputRef={confirmationRef} label="Confirmar senha" icon={LockKeyhole} placeholder="Digite sua senha novamente" password value={values.confirmPassword} onChangeText={value => change('confirmPassword', value)} error={errors.confirmPassword} autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword" maxLength={128} editable={!busy} returnKeyType="go" submitBehavior="submit" onSubmitEditing={() => void submit()} /> : null}
        {mode === 'login' ? <Button title="Esqueci minha senha" variant="quiet" onPress={() => router.push('/(auth)/forgot-password')} style={styles.forgot} /> : null}
        {mode === 'signup' ? <><Field label="Código de convite (opcional)" value={invite} editable={!busy} autoCapitalize="characters" autoCorrect={false} maxLength={16} onChangeText={value => { setInvite(value.toUpperCase()); setInviteConsent(false); }} />{invite.trim() ? <Checkbox label="Aceito o convite e quero adicionar quem me convidou como amigo no Arca." checked={inviteConsent} onChange={setInviteConsent} /> : null}</> : null}
      </View> : null}
      {mode === 'login' || mode === 'signup' ? <View style={styles.visitor}><AppText variant="small" color={colors.muted} style={styles.center}>Quer dar uma olhada primeiro?</AppText><Button title="Continuar sem conta" variant="quiet" onPress={() => void visit()} disabled={busy} /></View> : null}
      <Button title="Política de Privacidade" variant="quiet" disabled={busy} onPress={() => router.push('/privacy')} />
    </Screen>
  );
}
const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  intro: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  copy: { flex: 1, gap: spacing.xs }, form: { gap: spacing.md },
  forgot: { alignSelf: 'flex-end', paddingHorizontal: spacing.xs },
  visitor: { marginTop: 'auto', gap: spacing.xxs }, center: { textAlign: 'center' },
});
