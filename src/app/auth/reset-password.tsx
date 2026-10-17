import { router } from 'expo-router';
import { LockKeyhole } from 'lucide-react-native';
import { AuthForm } from '@/components/auth/AuthForm';
import { Screen } from '@/components/common/Screen';
import { EmptyState } from '@/components/common/States';
import { Button } from '@/components/common/Button';
import { useAuth } from '@/hooks/useAuth';
export default function ResetPassword() {
  const { session, isRecovery } = useAuth();
  if (!session || !isRecovery) return <Screen><EmptyState icon={LockKeyhole} title="Solicite um novo link" message="Abra o link de recuperação enviado ao seu e-mail para criar uma nova senha." /><Button title="Recuperar senha" onPress={() => router.replace(session ? '/(tabs)/profile' : '/(auth)/forgot-password')} /></Screen>;
  return <AuthForm mode="reset" />;
}
