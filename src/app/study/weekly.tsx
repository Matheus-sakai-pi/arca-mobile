import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, ArrowRight, CalendarDays, RotateCcw } from '@/components/icons';
import { Screen } from '@/components/common/Screen';
import { AppText } from '@/components/common/AppText';
import { IconButton } from '@/components/common/IconButton';
import { Button } from '@/components/common/Button';
import { Notice } from '@/components/common/Notice';
import { LoadingState } from '@/components/common/States';
import { useStudy } from '@/providers/StudyProvider';
import { useLearning } from '@/providers/LearningProvider';
import { weeklySummary } from '@/lib/weeklySummary';
import { dueReviews } from '@/lib/studyStore';
import { journeyUnits } from '@/data/lessons';
import { colors, fonts } from '@/constants/theme';
import { VisualArtwork } from '@/components/animation/VisualArtwork';

const dayLabel = (day: string) =>
  new Date(day + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
export default function Weekly() {
  const { state, loading, error, retry } = useStudy();
  const { unit, progress, pending, rejected } = useLearning();
  const [offset, setOffset] = useState(0);
  if (loading) return <LoadingState />;
  const summary = weeklySummary(state?.history ?? [], unit, new Date(), offset);
  const units = journeyUnits(unit);
  const topic = (id: string) => units.find(item => item.id === id)?.title ?? 'este assunto';
  const due = dueReviews(state?.history ?? [], unit, progress?.completedLessonIds ?? []);
  const oldest = state?.history.at(-1)?.day;
  return (
    <Screen>
      <View style={styles.heading}>
        <IconButton
          icon={ArrowLeft}
          label="Voltar"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/profile'))}
        />
        <AppText accessibilityRole="header" variant="h2" style={styles.grow}>
          Resumo semanal
        </AppText>
        <CalendarDays size={24} color={colors.tealInk} />
      </View>
      {error ? (
        <>
          <Notice tone="error" message={error} />
          <Button title="Tentar novamente" onPress={retry} />
        </>
      ) : null}
      <View style={styles.heading}>
        <IconButton
          icon={ArrowLeft}
          label="Semana anterior"
          disabled={!oldest || oldest >= summary.from}
          onPress={() => setOffset(value => value + 1)}
        />
        <View style={styles.grow}>
          <AppText style={styles.center}>
            {dayLabel(summary.from)} a {dayLabel(summary.to)}
          </AppText>
          <AppText variant="small" color={colors.muted} style={styles.center}>
            {offset === 0 ? 'Últimos 7 dias' : 'Período anterior'}
          </AppText>
        </View>
        <IconButton
          icon={ArrowRight}
          label="Semana seguinte"
          disabled={offset === 0}
          onPress={() => setOffset(value => value - 1)}
        />
      </View>
      {pending || rejected ? (
        <Notice message="Inclui resultados locais. O XP pode mudar após a sincronização." />
      ) : null}
      {!summary.exercises ? <VisualArtwork name="history" size={104} /> : null}
      <View style={styles.metrics}>
        {[
          { value: `${summary.activeDays}/7`, label: 'dias de estudo' },
          { value: summary.exercises, label: 'exercícios' },
          { value: summary.lessons, label: 'lições e revisões' },
          { value: summary.accuracy === null ? '—' : `${summary.accuracy}%`, label: 'acertos iniciais' },
        ].map(item => (
          <View key={item.label} style={styles.metric}>
            <AppText variant="h2" color={colors.primaryDark}>
              {item.value}
            </AppText>
            <AppText variant="small" color={colors.muted}>
              {item.label}
            </AppText>
          </View>
        ))}
      </View>
      <AppText variant="h3">Seu ritmo</AppText>
      <View style={styles.days}>
        {summary.days.map(day => (
          <View
            key={day.day}
            style={styles.day}
            accessibilityLabel={`${dayLabel(day.day)}: ${day.exercises} exercícios`}
          >
            <View style={[styles.marker, day.exercises > 0 && styles.active]}>
              <AppText variant="small" color={day.exercises ? colors.surface : colors.muted}>
                {day.exercises}
              </AppText>
            </View>
            <AppText variant="small" color={colors.muted}>
              {day.day.slice(8)}
            </AppText>
          </View>
        ))}
      </View>
      <AppText>
        {summary.exercises
          ? `${summary.xp} XP em novas lições neste período.`
          : 'Seu resumo começa com a primeira lição concluída.'}
      </AppText>
      {summary.improved ? (
        <Notice
          tone="success"
          message={`${topic(summary.improved.unitId)}: sua precisão subiu ${summary.improved.change} pontos percentuais em relação aos 7 dias anteriores.`}
        />
      ) : null}
      {offset === 0 ? (
        <View style={styles.suggestion}>
          <AppText variant="h3">Próximo passo</AppText>
          <AppText color={colors.muted}>
            {summary.weakest && summary.weakest.accuracy < 80
              ? `Vale praticar ${topic(summary.weakest.unitId)} novamente.`
              : due.length
                ? `${due.length} lição${due.length === 1 ? ' está pronta' : 's estão prontas'} para revisão.`
                : 'Continue sua jornada, uma lição de cada vez.'}
          </AppText>
          <Button
            variant="secondary"
            icon={RotateCcw}
            title={due.length ? 'Revisar agora' : 'Continuar aprendendo'}
            onPress={() => router.push(due.length ? '/study/review' : '/(tabs)/learn')}
          />
        </View>
      ) : null}
      {state?.history.length === 500 ? (
        <Notice message="Resumo limitado às 500 tentativas mais recentes disponíveis neste aparelho." />
      ) : null}
    </Screen>
  );
}
const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  grow: { flex: 1, minWidth: 0 },
  center: { textAlign: 'center' },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metric: { width: '47%', paddingVertical: 16, borderBottomWidth: 1, borderColor: colors.border },
  days: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  day: { alignItems: 'center', gap: 6, flex: 1 },
  marker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.track,
    alignItems: 'center',
    justifyContent: 'center',
  },
  active: { backgroundColor: colors.tealInk },
  suggestion: { gap: 12, paddingVertical: 16, borderTopWidth: 1, borderColor: colors.border },
  label: { fontFamily: fonts.bold },
});
