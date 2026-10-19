import { router } from 'expo-router';
import { Compass } from '@/components/icons';
import { Screen } from '@/components/common/Screen';
import { EmptyState } from '@/components/common/States';
import { Button } from '@/components/common/Button';
export default function NotFound() {
  return (
    <Screen>
      <EmptyState icon={Compass} title="Vamos voltar ao caminho?" message="Esta página não foi encontrada." />
      <Button title="Voltar ao início" onPress={() => router.replace('/')} />
    </Screen>
  );
}
