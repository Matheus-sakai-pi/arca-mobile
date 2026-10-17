import { useEffect, useRef, useState, type ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { ArrowLeft, RefreshCw, ArrowRight } from 'lucide-react-native';
import { useEnergy } from '@/providers/EnergyProvider';
import { useStudy } from '@/providers/StudyProvider';
import { energyWait, monotonicNow, type EnergyState } from '@/lib/energy';
import type { LessonDraft } from '@/lib/studyStore';
import type { Lesson } from '@/types/learning';
import { returnToTrail } from '@/lib/learningNavigation';
import { Screen } from '@/components/common/Screen';
import { Button } from '@/components/common/Button';
import { AppText } from '@/components/common/AppText';
import { Notice } from '@/components/common/Notice';
import { LoadingState } from '@/components/common/States';
import { BatteryIcon } from './BatteryIcon';
import { colors, spacing } from '@/constants/theme';

export function EnergyGate({
  lesson,
  draft,
  children,
}: {
  lesson: Lesson;
  draft: LessonDraft | null;
  children: (draft: LessonDraft) => ReactNode;
}) {
  const { open } = useEnergy();
  const { saveDraft } = useStudy();
  const local = useRef(draft);
  const [opened, setOpened] = useState<{ status: EnergyState; draft: LessonDraft } | null>(null);
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null),
    [revision, setRevision] = useState(0),
    [receivedAt, setReceivedAt] = useState(monotonicNow);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const next = await open(lesson, local.current);
        await saveDraft(lesson, next.draft.attemptId, next.draft.state);
        if (!active) return;
        local.current = next.draft;
        setOpened(next);
        setReceivedAt(monotonicNow());
        const remaining = next.status.session?.remainingNew ?? 0;
        const needsWarning =
          next.status.enabled &&
          !next.status.session?.legacy &&
          remaining * next.status.rules.exerciseCost > next.status.balance;
        setReady(!needsWarning);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível preparar a lição.');
      } finally {
        if (active) setBusy(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [lesson, open, saveDraft, revision]);
  if (ready && opened) return children(opened.draft);
  if (busy) return <LoadingState message="Preparando sua lição..." />;
  const state = opened?.status;
  const empty = state?.enabled && state.balance < state.rules.exerciseCost;
  return (
    <Screen
      style={styles.content}
      footer={
        <>
          {opened && !empty && !error ? (
            <Button title="Começar mesmo assim" icon={ArrowRight} onPress={() => setReady(true)} />
          ) : null}
          <Button
            title={error ? 'Tentar novamente' : 'Atualizar bateria'}
            icon={RefreshCw}
            variant={empty || error ? 'primary' : 'secondary'}
            onPress={() => {
              setBusy(true);
              setError(null);
              setRevision(value => value + 1);
            }}
          />
          <Button title="Sair" icon={ArrowLeft} variant="quiet" onPress={returnToTrail} />
        </>
      }
    >
      <View style={styles.art}>
        <BatteryIcon size={144} />
      </View>
      <AppText accessibilityRole="header" variant="h1">
        {error
          ? 'Vamos conferir sua conexão'
          : empty
            ? 'Hora de recarregar'
            : 'Sua bateria pode não ser suficiente'}
      </AppText>
      <AppText variant="h3">{lesson.title}</AppText>
      {state ? (
        <>
          <AppText variant="h2">
            {state.balance} de {state.rules.capacity} energias
          </AppText>
          <AppText color={colors.muted}>
            Faltam aproximadamente {state.session?.remainingNew ?? 0} exercícios novos nesta tentativa. Cada
            um usa {state.rules.exerciseCost} energia.
          </AppText>
          {state.nextRefillAt ? (
            <AppText color={colors.muted}>Próxima energia em {energyWait(state, receivedAt)}.</AppText>
          ) : null}
        </>
      ) : null}
      <AppText color={colors.muted}>
        Você pode sair e continuar a mesma tentativa depois. Os bônus de acertos podem ajudar durante a lição.
      </AppText>
      {error ? <Notice tone="error" message={error} /> : null}
    </Screen>
  );
}
const styles = StyleSheet.create({
  content: { justifyContent: 'center', gap: spacing.md },
  art: { alignItems: 'center', marginBottom: spacing.md },
});
