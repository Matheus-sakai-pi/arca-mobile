import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, History as HistoryIcon } from 'lucide-react-native';
import { useStudy } from '@/providers/StudyProvider';
import { useLearning } from '@/providers/LearningProvider';
import { subjectPerformance } from '@/lib/studyStore';
import { journeyUnits } from '@/data/lessons';
import { Screen } from '@/components/common/Screen';
import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { IconButton } from '@/components/common/IconButton';
import { EmptyState, LoadingState } from '@/components/common/States';
import { Notice } from '@/components/common/Notice';
import { ProgressBar } from '@/components/learning/ProgressBar';
import { colors, spacing } from '@/constants/theme';
export default function History() {
  const { state, loading, error } = useStudy();
  const { unit, pending, rejected } = useLearning();
  const [limit, setLimit] = useState(20);
  if (loading) return <LoadingState />;
  const history = state?.history ?? [];
  const groups = subjectPerformance(history, unit);
  const units = journeyUnits(unit);
  return (
    <Screen>
      <IconButton
        icon={ArrowLeft}
        label="Voltar"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/profile'))}
      />
      <AppText accessibilityRole="header" variant="h2">
        Histórico de estudo
      </AppText>
      {error ? <Notice tone="error" message={error} /> : null}
      {pending ? (
        <Notice message="Há resultados deste aparelho aguardando confirmação da sincronização." />
      ) : null}
      {rejected ? (
        <Notice message="Algumas tentativas locais não foram aceitas pela sincronização. O XP confirmado aparece no Perfil." />
      ) : null}
      {groups.length ? (
        <AppText variant="h3">Desempenho recente por assunto</AppText>
      ) : (
        <EmptyState
          icon={HistoryIcon}
          artwork="history"
          title="Sua história começa aqui"
          message="Seu histórico aparece depois de concluir uma lição."
        />
      )}
      {groups.map(group => (
        <View key={group.unitId} style={styles.item}>
          <AppText variant="h3">
            {units.find(item => item.id === group.unitId)?.title ?? group.unitId}
          </AppText>
          <AppText variant="small">
            {group.correct}/{group.total} acertos iniciais · {group.accuracy}%
          </AppText>
          <ProgressBar value={group.accuracy} label="Precisão do assunto" />
        </View>
      ))}
      {history.length ? <AppText variant="h3">Últimas tentativas</AppText> : null}
      {history.slice(0, limit).map(entry => (
        <View key={entry.result.attemptId} style={styles.item}>
          <AppText variant="h3">
            {unit.lessons.find(lesson => lesson.id === entry.result.lessonId)?.title ?? 'Lição anterior'}
          </AppText>
          <AppText variant="small" color={colors.muted}>
            {new Date(entry.result.completedAt).toLocaleString('pt-BR')}
          </AppText>
          <AppText>
            {entry.result.correct}/{entry.result.total} acertos · {entry.result.accuracy}% · +
            {entry.result.xpEarned} XP
          </AppText>
        </View>
      ))}
      {history.length > limit ? (
        <Button title="Carregar mais" variant="secondary" onPress={() => setLimit(value => value + 20)} />
      ) : null}
    </Screen>
  );
}
const styles = StyleSheet.create({
  item: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
