import type { PropsWithChildren } from 'react';
import { View } from 'react-native';
import { Screen } from '@/components/common/Screen';
import { ErrorState, LoadingState } from '@/components/common/States';
import { useLearning } from '@/providers/LearningProvider';
import { SyncNotice } from './SyncNotice';

export function LearningGate({ children }: PropsWithChildren) {
  const { progress, loading, error, retry } = useLearning();
  if (loading) return <LoadingState message="Carregando sua jornada…" />;
  if (error || !progress)
    return (
      <Screen>
        <ErrorState message={error ?? 'Seu progresso ainda não está disponível.'} onRetry={retry} />
      </Screen>
    );
  return (
    <View style={{ flex: 1 }}>
      <SyncNotice />
      {children}
    </View>
  );
}
