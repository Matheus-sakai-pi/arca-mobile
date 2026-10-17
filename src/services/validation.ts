import { validUsername, usernameHint } from '../lib/username.ts';

export type AuthFormMode = 'login' | 'signup' | 'forgot' | 'reset';
export type AuthValues = { name: string; email: string; password: string; confirmPassword: string };
export type AuthFieldErrors = Partial<Record<keyof AuthValues, string>>;
export function validateAuth(mode: AuthFormMode, values: AuthValues): AuthFieldErrors {
  const errors: AuthFieldErrors = {};
  if (mode === 'signup' && !validUsername(values.name)) errors.name = usernameHint;
  if (mode !== 'reset' && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()) || values.email.trim().length > 254)) errors.email = 'Digite um e-mail válido.';
  if (mode === 'login' && !values.password) errors.password = 'Digite sua senha.';
  if ((mode === 'signup' || mode === 'reset') && (values.password.length < 8 || values.password.length > 128)) errors.password = 'Sua senha deve ter entre 8 e 128 caracteres.';
  if ((mode === 'signup' || mode === 'reset') && values.password !== values.confirmPassword) errors.confirmPassword = 'As senhas precisam ser iguais.';
  return errors;
}
export function authErrorMessage(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string' ? error.code : '';
  const message = error instanceof Error ? error.message : '';
  if (message.includes('username_taken') || message.includes('profiles_username_key') || message.includes('profiles_claimed_username')) return 'Esse nome de usuário já está em uso. Escolha outro.';
  if (message === 'username_setup_required') return 'A escolha de nome de usuário precisa ser habilitada no servidor.';
  if (message === 'username_unavailable') return 'Não foi possível verificar esse nome agora. Confira a conexão e tente novamente.';
  if (message.includes('username_invalid') || message === usernameHint) return usernameHint;
  if (message === 'auth_not_configured') return 'As contas ainda não estão disponíveis. Você pode conhecer o Arca sem entrar.';
  if (message === 'auth_link_invalid' || code === 'otp_expired') return 'Este link expirou ou já foi usado. Solicite um novo e-mail.';
  const messages: Record<string, string> = {
    invalid_credentials: 'E-mail ou senha incorretos. Confira e tente novamente.',
    email_not_confirmed: 'Confirme seu e-mail antes de entrar. Confira também a caixa de spam.',
    user_already_exists: 'Já existe uma conta com este e-mail. Entre ou recupere sua senha.',
    weak_password: 'Escolha uma senha mais forte, com letras, números e símbolos.',
    same_password: 'Escolha uma senha diferente da anterior.',
    over_request_rate_limit: 'Muitas tentativas. Aguarde um pouco e tente novamente.',
    over_email_send_rate_limit: 'Aguarde alguns minutos antes de solicitar outro e-mail.',
    email_address_invalid: 'Confira seu endereço de e-mail.',
    signup_disabled: 'Novos cadastros estão temporariamente indisponíveis.',
  };
  if (messages[code]) return messages[code];
  if (/fetch|network|abort|timeout/i.test(message)) return 'Não foi possível conectar. Confira sua internet e tente novamente.';
  return 'Não foi possível concluir. Tente novamente em alguns instantes.';
}
