import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { MailCheck } from 'lucide-react-native';
import { Screen } from '@/components/common/Screen';
import { Brand } from '@/components/common/Brand';
import { Button } from '@/components/common/Button';
import { EmptyState } from '@/components/common/States';
import { Notice } from '@/components/common/Notice';
import { authRedirectUrl } from '@/services/auth';
import { authErrorMessage } from '@/services/validation';
import { requireSupabase } from '@/lib/supabase';

export default function ConfirmEmail() {
  const params = useLocalSearchParams<{ email?: string }>();
  const email = typeof params.email === 'string' ? params.email : '';
  const [cooldown, setCooldown] = useState(60);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ message: string; tone: 'error' | 'success' } | null>(null);
  useEffect(() => { const timer = setInterval(() => setCooldown(value => Math.max(0, value - 1)), 1000); return () => clearInterval(timer); }, []);
  async function resend() {
    setBusy(true);
    try {
      const { error } = await requireSupabase().auth.resend({ type: 'signup', email, options: { emailRedirectTo: authRedirectUrl() } });
      if (error) throw error;
      setCooldown(60);
      setNotice({ tone: 'success', message: 'Solicitação enviada. Confira seu e-mail e a caixa de spam.' });
    } catch (error) { setNotice({ tone: 'error', message: authErrorMessage(error) }); }
    finally { setBusy(false); }
  }
  return <Screen footer={<Button title="Voltar para entrar" onPress={() => router.replace('/(auth)/login')} />}><Brand compact /><EmptyState icon={MailCheck} title="Confira seu e-mail" message={email ? `Enviamos as instruções para ${email}. Abra o link de confirmação para continuar.` : 'Abra o link no seu e-mail para confirmar sua conta.'} />{notice ? <Notice {...notice} /> : null}<Button title={cooldown ? `Reenviar em ${cooldown}s` : 'Reenviar confirmação'} variant="secondary" disabled={cooldown > 0 || !email} loading={busy} onPress={() => void resend()} /></Screen>;
}
