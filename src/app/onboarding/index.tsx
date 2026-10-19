import { useCallback, useReducer, useRef, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ArrowLeft, ArrowRight, BookOpen, Check, CheckCircle2, Clock3, LogIn, RotateCcw, ShieldCheck, Star, UserPlus, type LucideIcon } from '@/components/icons';
import { Screen } from '@/components/common/Screen';
import { Brand } from '@/components/common/Brand';
import { Button } from '@/components/common/Button';
import { IconButton } from '@/components/common/IconButton';
import { AppText } from '@/components/common/AppText';
import { Notice } from '@/components/common/Notice';
import { Mascot } from '@/components/mascot/Mascot';
import { VisualArtwork } from '@/components/animation/VisualArtwork';
import { ProgressBar } from '@/components/learning/ProgressBar';
import { QuestionRenderer } from '@/components/learning/QuestionRenderer';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useAuth } from '@/hooks/useAuth';
import { energyIntervalText, ENERGY_MAX } from '@/lib/energy';
import { ENERGY_CONFIG } from '@/config/energy';
import { BatteryIcon } from '@/components/learning/BatteryIcon';
import { initialOnboarding, onboardingQuestion, onboardingSteps, reduceOnboarding } from '@/lib/onboarding';
import { colors, layout, spacing } from '@/constants/theme';

export default function Onboarding() {
  const [state, dispatch] = useReducer(reduceOnboarding, initialOnboarding);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = useRef(false);
  const { complete } = useOnboarding();
  const { enterGuest } = useAuth();
  const { height } = useWindowDimensions();
  const compact = height < 780;
  const index = onboardingSteps.indexOf(state.step);
  const correct = state.answer === onboardingQuestion.correctAnswer;
  const final = state.step === 'ready';

  useFocusEffect(useCallback(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (locked.current) return true;
      if (state.step === 'welcome') return false;
      dispatch({ type: 'back' });
      return true;
    });
    return () => listener.remove();
  }, [state.step]));

  async function finish(destination: 'signup' | 'login' | 'guest') {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError(null);
    try {
      await complete();
      if (destination === 'guest') { enterGuest(); router.replace('/(tabs)/learn'); }
      else router.replace(destination === 'signup' ? '/(auth)/signup' : '/(auth)/login');
    } catch {
      setError('Não foi possível continuar. Tente novamente.');
    } finally { locked.current = false; setBusy(false); }
  }

  const action = final ? 'Criar minha conta' : state.step === 'welcome' ? 'Experimentar' : state.step === 'practice' && !state.verified ? 'Conferir resposta' : 'Continuar';
  return <Screen resetScrollKey={state.step} style={styles.screen} footer={<>
    {error ? <Notice tone="error" message={error} /> : null}
    <Button title={action} icon={final ? UserPlus : state.step === 'practice' && !state.verified ? Check : ArrowRight} loading={busy} disabled={state.step === 'practice' && !state.verified && state.answer === null} onPress={() => {
      if (final) void finish('signup');
      else dispatch({ type: state.step === 'practice' && !state.verified ? 'verify' : 'next' });
    }} />
    {final ? <Button title="Continuar sem conta" icon={ArrowRight} variant="secondary" disabled={busy} onPress={() => void finish('guest')} /> : null}
    <Button title="Já tenho uma conta" icon={LogIn} variant="quiet" disabled={busy} onPress={() => void finish('login')} />
  </>}>
    <View style={styles.header}>
      <View style={styles.back}>{index > 0 ? <IconButton icon={ArrowLeft} label="Voltar uma etapa" disabled={busy} onPress={() => dispatch({ type: 'back' })} /> : null}</View>
      <Brand compact />
      <View style={styles.skip}>{!final ? <Pressable accessibilityRole="button" accessibilityLabel="Pular apresentação" accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => dispatch({ type: 'skip' })} style={styles.skip}><AppText variant="small" color={colors.muted}>Pular</AppText></Pressable> : null}</View>
    </View>
    <View style={styles.progress}><View style={styles.track}><ProgressBar compact value={(index + 1) / onboardingSteps.length * 100} label="Progresso da apresentação" /></View><AppText testID="onboarding-step" variant="label" color={colors.muted}>{index + 1} de {onboardingSteps.length}</AppText></View>

    <View testID={`onboarding-${state.step}`} style={[styles.stage, state.step === 'practice' && styles.practice]}>
      {state.step === 'welcome' ? <>
        <Mascot state="idle" size={compact ? 128 : 184} animated decorative />
        <Copy eyebrow="BEM-VINDO AO ARCA" title="A Bíblia, um passo de cada vez." description="Pequenas lições para conhecer as histórias e aprender no seu ritmo." />
        <View style={styles.benefits}><View style={styles.benefit}><BookOpen size={20} color={colors.primaryDark} /><AppText variant="small">Lições curtas</AppText></View><View style={styles.benefit}><Star size={20} color={colors.goldInk} /><AppText variant="small">Seu progresso</AppText></View></View>
      </> : null}

      {state.step === 'practice' ? <>
        <Copy eyebrow="UMA PERGUNTA PARA EXPERIMENTAR" title="Vamos tentar juntos?" description="Só uma demonstração: não usa energia, não vale XP e não muda seu progresso." compact />
        {state.verified ? <View testID="onboarding-feedback" accessibilityLiveRegion="polite" style={styles.feedback}>
          <View style={styles.feedbackHeading}><CheckCircle2 size={22} color={colors.tealInk} /><AppText variant="h3" color={colors.tealInk} style={styles.grow}>{correct ? 'Isso mesmo!' : 'Tudo bem aprender tentando.'}</AppText><Mascot state={correct ? 'happy' : 'encouraging'} size={56} decorative /></View>
          <AppText variant="small" color={colors.muted}>Sua resposta: {onboardingQuestion.options.find(option => option.id === state.answer)?.label}</AppText>
          <AppText>{onboardingQuestion.explanation}</AppText>
          {!correct ? <Button title="Tentar de novo" icon={RotateCcw} variant="quiet" onPress={() => dispatch({ type: 'retry' })} /> : null}
        </View> : <QuestionRenderer question={onboardingQuestion} answer={state.answer} verified={false} onAnswer={answer => { if (typeof answer === 'string') dispatch({ type: 'answer', answer }); }} />}
        {state.verified ? <AppText variant="small" color={colors.muted}>Nas lições, você também recebe uma explicação depois de responder.</AppText> : null}
      </> : null}

      {state.step === 'energy' ? <>
        <VisualArtwork name="energy" size={compact ? 96 : 112} />
        <Copy eyebrow="NO SEU RITMO" title="Sua bateria se recupera." description="Não precisa terminar tudo de uma vez." compact />
        <AppText variant="label" color={colors.primaryDark}>Capacidade: {ENERGY_MAX} energias</AppText>
        <View style={styles.details}><View style={styles.detail}><BatteryIcon size={24} /><AppText variant="small" color={colors.muted} style={styles.grow}>Cada exercício respondido usa {ENERGY_CONFIG.exerciseCost} energia, acertando ou errando.</AppText></View><Detail icon={Clock3} text={`Recupere 1 a cada ${energyIntervalText()}, até o máximo de ${ENERGY_MAX}.`} /><Detail icon={RotateCcw} text="Corrigir os erros no fim da tentativa é gratuito. Retomar não cobra respostas já registradas." /></View>
      </> : null}

      {final ? <>
        <Mascot state="encouraging" size={compact ? 112 : 144} animated decorative />
        <Copy eyebrow="PRONTO PARA O PRIMEIRO PASSO" title="A próxima história é sua." description="Com uma conta, salve suas lições e seu XP." />
        <View style={styles.details}><Detail icon={ShieldCheck} text="Sem conta, o progresso fica só neste aparelho. Você pode criar uma conta depois." /></View>
      </> : null}
    </View>
  </Screen>;
}

function Copy({ eyebrow, title, description, compact = false }: { eyebrow: string; title: string; description: string; compact?: boolean }) {
  return <View style={[styles.copy, compact && styles.left]}><AppText variant="label" color={colors.tealInk} style={!compact && styles.center}>{eyebrow}</AppText><AppText variant={compact ? 'h2' : 'h1'} accessibilityRole="header" style={!compact && styles.center}>{title}</AppText><AppText color={colors.muted} variant={compact ? 'small' : 'body'} style={!compact && styles.center}>{description}</AppText></View>;
}

function Detail({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return <View style={styles.detail}><Icon size={20} color={colors.tealInk} /><AppText variant="small" color={colors.muted} style={styles.grow}>{text}</AppText></View>;
}

const styles = StyleSheet.create({
  screen: { gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  back: { width: layout.touchTarget, height: layout.touchTarget },
  skip: { width: 56, minHeight: layout.touchTarget, alignItems: 'center', justifyContent: 'center' },
  progress: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  track: { flex: 1 },
  stage: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xs },
  practice: { justifyContent: 'flex-start', alignItems: 'stretch', paddingTop: spacing.sm },
  copy: { gap: spacing.xs, width: '100%', maxWidth: 380 },
  left: { alignSelf: 'flex-start' },
  center: { textAlign: 'center' },
  benefits: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.md, width: '100%', paddingTop: spacing.md, borderTopWidth: 1, borderColor: colors.border },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  details: { width: '100%', gap: spacing.sm, paddingTop: spacing.md, borderTopWidth: 1, borderColor: colors.border },
  detail: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  feedback: { padding: spacing.md, gap: spacing.sm, borderRadius: 8, borderWidth: 1, borderColor: colors.tealInk, backgroundColor: colors.tealSoft },
  feedbackHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  grow: { flex: 1, minWidth: 0 },
});
