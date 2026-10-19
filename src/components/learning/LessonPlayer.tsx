import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { BackHandler, Modal, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { ArrowRight, CheckCircle2, X } from 'lucide-react-native';
import { Screen } from '@/components/common/Screen';
import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { IconButton } from '@/components/common/IconButton';
import { Notice } from '@/components/common/Notice';
import { Mascot } from '@/components/mascot/Mascot';
import { BatteryIcon } from './BatteryIcon';
import { EmptyBatteryContent } from '@/components/membership/EmptyBatteryContent';
import { OfferLayout } from '@/components/membership/OfferLayout';
import { BatteryTip } from './BatteryTip';
import { learningUnits } from '@/data/lessons';
import { unitTrailTheme } from '@/lib/trailAppearance';
import { EnergyMeter } from './EnergyMeter';
import { RewardPulse } from '@/components/animation/RewardPulse';
import { useEnergy } from '@/providers/EnergyProvider';
import { energyWait, type EnergyReceipt } from '@/lib/energy';
import { ProgressBar } from './ProgressBar';
import { QuestionRenderer, questionInstructions } from './QuestionRenderer';
import { createAttempt, isCorrect, reduceAttempt } from '@/lib/lessonEngine';
import { canVerify, correctResponse } from '@/lib/questionEngine';
import { returnToTrail } from '@/lib/learningNavigation';
import { useLearning } from '@/providers/LearningProvider';
import { useLessonSounds } from '@/hooks/useLessonSounds';
import { usePreferences } from '@/providers/PreferencesProvider';
import { useStudy } from '@/providers/StudyProvider';
import { useMotionPreference } from '@/hooks/useMotionPreference';
import { useStudySession } from '@/hooks/useStudySession';
import type { LessonDraft } from '@/lib/studyStore';
import { QuestionReport } from './QuestionReport';
import type { ContentCardQuestion, Lesson } from '@/types/learning';
import { colors, radius, spacing } from '@/constants/theme';

let attemptSequence = 0;
const normalizeTitle = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export function LessonPlayer({ lesson, draft=null }: { lesson: Lesson; draft?:LessonDraft|null }) {
  const { finishLesson, startLesson, endLesson } = useLearning();
  const energy = useEnergy();
  const playFeedbackSound = useLessonSounds();
  const {saveDraft,complete:recordStudy,error:studyError}=useStudy();
  const {hapticsEnabled}=usePreferences();
  const reduced=useMotionPreference();
  const [attemptId] = useState(() => draft?.attemptId ?? `${lesson.id}:${Date.now()}:${++attemptSequence}`);
  const [state, dispatch] = useReducer((current: ReturnType<typeof createAttempt>, action: Parameters<typeof reduceAttempt>[2]) => reduceAttempt(lesson, current, action), draft?.state, value=>value ?? createAttempt());
  useStudySession(lesson.id,attemptId,state.turn);
  const [exitVisible, setExitVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [batteryBlocked, setBatteryBlocked] = useState(false);
  const [bonus, setBonus] = useState<EnergyReceipt | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const savingRef = useRef(false);
  const actionLock = useRef(false);
  useEffect(()=>{void saveDraft(lesson,attemptId,state).catch(()=>undefined);},[lesson,attemptId,state,saveDraft]);
  useEffect(() => { actionLock.current = false; }, [state.turn, state.phase]);
  const batteryEmpty = batteryBlocked && !energy.status?.unlimited && (!energy.status || energy.status.balance < energy.status.rules.exerciseCost);
  const question = lesson.questions[state.index];
  const verified = state.phase === 'feedback';
  const reading = question?.type === 'content_card';
  const exerciseTotal=lesson.questions.filter(item=>item.type !== 'content_card').length;
  const exerciseNumber=lesson.questions.slice(0,state.index+1).filter(item=>item.type !== 'content_card').length;
  const revisiting = state.turn >= lesson.questions.length;
  const remainingExercises = exerciseTotal - state.mastered.length;
  const exerciseKey = `${question?.id}:${state.turn}`;
  const correct = question ? isCorrect(question, state.answer) : false;
  // Evita repetir o título da lição quando a pergunta tem exatamente o mesmo texto.
  const sameAsTitle = !!question && normalizeTitle(question.prompt) === normalizeTitle(lesson.title);
  // A barra de progresso usa a cor da unidade, a mesma da trilha.
  const unitColor = unitTrailTheme(Math.max(0, learningUnits.findIndex(unit => unit.id === lesson.unitId))).color;
  const requestExit = useCallback(() => { if (!savingRef.current) {setSaveError(null);setExitVisible(true);} }, []);
  useFocusEffect(useCallback(() => {
    startLesson(lesson.id);
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { requestExit(); return true; });
    return () => { listener.remove(); endLesson(lesson.id); };
  }, [requestExit,lesson.id,startLesson,endLesson]));
  if (!question) return <Screen><AppText>Esta lição não possui perguntas disponíveis.</AppText><Button title="Voltar à trilha" onPress={returnToTrail} /></Screen>;
  async function verify() {
    if (!question || actionLock.current || state.phase !== 'answering' || !canVerify(question, state.answer)) return;
    actionLock.current = true;
    savingRef.current = true; setConfirming(true); setSaveError(null); setBonus(null); setBatteryBlocked(false);
    try {
      await saveDraft(lesson, attemptId, state);
      const receipt = await energy.answer(lesson.id, attemptId, question.id, state.answer, state.turn);
      if (!receipt.allowed) { setBatteryBlocked(true); return; }
      if (!receipt.receipt || receipt.receipt.correct !== correct) throw new Error('A pergunta mudou. Saia e retome a tentativa para conferir o conteúdo atual.');
      await saveDraft(lesson, attemptId, reduceAttempt(lesson, state, { type: 'verify' }));
      dispatch({ type: 'verify' });
      if (receipt.receipt.bonuses.length) setBonus(receipt.receipt);
      void playFeedbackSound(correct ? 'correct' : 'wrong');
      if (hapticsEnabled && Platform.OS !== 'web') void Haptics.notificationAsync(correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error).catch(() => undefined);
    } catch (error) { setSaveError(error instanceof Error ? error.message : 'Conecte-se para confirmar sua resposta.'); }
    finally { savingRef.current = false; actionLock.current = false; setConfirming(false); }
  }
  async function continueLesson() {
    if ((!verified && !reading) || savingRef.current || actionLock.current) return;
    actionLock.current = true; savingRef.current = true; setSaving(true); setSaveError(null);
    try {
      if (reading) await energy.answer(lesson.id, attemptId, question!.id, 'seen', state.turn);
      const next = reduceAttempt(lesson, state, { type: reading ? 'read' : 'continue' });
      if (next.phase !== 'finished') {
        await saveDraft(lesson, attemptId, next);
        setBonus(null); dispatch({ type: reading ? 'read' : 'continue' }); return;
      }
      await energy.finish(lesson.id, attemptId);
      const result=await finishLesson(lesson, next.answers, attemptId);
      await recordStudy(result,lesson,next.answers);
      router.replace('/lesson/result');
    } catch(error) {
      setSaveError(error instanceof Error ? error.message : 'Não foi possível salvar a lição. Toque em Continuar para tentar novamente.');
    } finally { savingRef.current = false; actionLock.current = false; setSaving(false); }
  }
  async function pauseLesson() {
    if(savingRef.current)return;
    savingRef.current=true;setSaving(true);setSaveError(null);
    try {await saveDraft(lesson,attemptId,state);setExitVisible(false);returnToTrail();}
    catch {setSaveError('Não foi possível salvar sua tentativa. Tente novamente.');}
    finally {savingRef.current=false;setSaving(false);}
  }
  return <>
    <Screen style={styles.content} resetScrollKey={exerciseKey} footer={<>
      {bonus ? <View testID="battery-bonus" accessibilityLiveRegion="polite" style={styles.bonus}><RewardPulse event={bonus.key} motion="rise"><BatteryIcon size={40} /></RewardPulse><View style={styles.feedbackCopy}><AppText variant="h3" color="#A51965">{bonus.bonuses.reduce((sum, item) => sum + item.amount, 0) ? `+${bonus.bonuses.reduce((sum, item) => sum + item.amount, 0)} energias` : 'Bateria cheia'}</AppText><AppText variant="small">{bonus.bonuses.some(item => item.kind === 'perfect') ? 'Acertos e lição perfeita' : 'Bônus por acertos seguidos'}</AppText></View></View> : null}
      {verified ? <Animated.View testID="lesson-feedback" key={exerciseKey} entering={FadeInDown.duration(180).reduceMotion(reduced ? ReduceMotion.Always : ReduceMotion.System)} accessibilityLiveRegion="polite" style={[styles.feedback, { backgroundColor: correct ? colors.successSoft : colors.errorSoft, borderColor: correct ? colors.success : colors.error }]}><View style={styles.feedbackHeading}><View style={styles.feedbackCopy}><View style={styles.feedbackTitle}>{correct ? <CheckCircle2 size={22} color={colors.success} /> : <X size={22} color={colors.error} />}<AppText variant="h3" color={correct ? colors.success : colors.error}>{correct ? 'Correto!' : 'Quase!'}</AppText></View>{!correct ? <AppText variant="small">Resposta correta: {correctResponse(question)}</AppText> : null}</View><Mascot state={correct ? 'happy' : 'wrong_answer'} size={72} animated motionKey={exerciseKey} decorative /></View><AppText variant="small">{question.explanation}</AppText></Animated.View> : null}
      {saveError ? <Notice tone="error" message={saveError} /> : null}
      <Button icon={ArrowRight} title={verified || reading ? 'Continuar' : 'Verificar'} disabled={!reading && !verified && !canVerify(question, state.answer)} loading={saving || confirming} onPress={() => { if (verified || reading) void continueLesson(); else void verify(); }} />
    </>}>
      <View style={styles.top}><IconButton icon={X} label="Sair da lição" onPress={requestExit} /><View style={styles.progress}><ProgressBar value={state.mastered.length / exerciseTotal * 100} label="Progresso da lição" color={unitColor} thick /><AppText variant="small" color={colors.text}>{reading ? 'Leitura' : revisiting ? `Revisão · ${remainingExercises} pendente${remainingExercises === 1 ? '' : 's'}` : `Exercício ${exerciseNumber}/${exerciseTotal}`}</AppText></View><EnergyMeter lesson /></View>
      {reading ? null : <BatteryTip />}
      <View testID="lesson-exercise" style={styles.exercise}>
        <View style={styles.exerciseHeader}>
          <View style={styles.exerciseHeading}>
            {sameAsTitle ? null : <AppText variant="label" color={colors.primaryDark}>{lesson.title}</AppText>}
            <AppText variant="small" color={colors.muted}>{questionInstructions[question.type]}</AppText>
          </View>
          <QuestionReport lessonId={lesson.id} questionId={question.id} compact />
        </View>
        {revisiting && question.type === 'story_summary' ? <AppText>{lesson.questions.find((item): item is ContentCardQuestion => item.id === question.contentId && item.type === 'content_card')?.body}</AppText> : null}
        <QuestionRenderer key={exerciseKey} question={question} answer={state.answer} verified={verified} onAnswer={answer => { if (!actionLock.current && !savingRef.current) dispatch({ type: 'answer', answer }); }} />
      </View>
      {studyError ? <Notice tone="error" message={studyError} /> : null}
    </Screen>
    <Modal visible={batteryEmpty} transparent animationType={reduced ? 'none' : 'fade'} onRequestClose={() => { void pauseLesson(); }}>
      <View testID="battery-exhausted" accessibilityViewIsModal style={styles.energyModal}><OfferLayout footer={<>{saveError ? <Notice tone="error" message={saveError} /> : null}<Button title="Atualizar bateria" variant="secondary" disabled={saving} onPress={() => void energy.refresh()} /><Button title="Salvar e sair" variant="quiet" loading={saving} onPress={() => void pauseLesson()} /></>}><EmptyBatteryContent title="Sem energia agora" wait={energy.status?.nextRefillAt ? energyWait(energy.status, energy.receivedAt) : undefined} onNavigate={() => setBatteryBlocked(false)} /></OfferLayout></View>
    </Modal>
    <Modal visible={exitVisible} transparent animationType={reduced ? 'none' : 'fade'} onRequestClose={() => {if(!savingRef.current)setExitVisible(false);}}>
      <ScrollView style={styles.modalScroll} contentContainerStyle={styles.overlay}><View accessibilityViewIsModal style={styles.dialog}>
        <AppText variant="h2">Pausar a lição?</AppText><AppText color={colors.muted}>Sua tentativa fica guardada neste aparelho. Você pode continuar deste ponto quando voltar.</AppText>
        {saveError ? <Notice tone="error" message={saveError} /> : null}
        <Button title="Continuar estudando" disabled={saving} onPress={() => setExitVisible(false)} />
        <Button title="Salvar e sair" variant="secondary" loading={saving} onPress={()=>void pauseLesson()} />
      </View></ScrollView>
    </Modal>
  </>;
}
const styles = StyleSheet.create({
  content: { gap: spacing.md },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56 },
  progress: { flex: 1, minWidth: 0, gap: spacing.xs },
  bonus: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: 8, backgroundColor: '#FDEAF5' },
  batteryArt: { alignItems: 'center' },
  energyModal: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: 'white' },
  exercise: { paddingVertical: spacing.sm, gap: spacing.xs },
  exerciseHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  exerciseHeading: { flex: 1, minWidth: 0, gap: spacing.xxs },
  instruction: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  instructionText: { flex: 1 },
  feedback: { borderRadius: radius.sm, padding: spacing.sm, gap: spacing.xs, marginBottom: spacing.xs, borderLeftWidth: 3 },
  feedbackHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  feedbackCopy: { flex: 1, minWidth: 0, gap: spacing.xxs },
  feedbackTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  modalScroll: {flex:1,backgroundColor:'rgba(34,33,42,0.45)'},
  overlay: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  dialog: { width: '100%', maxWidth: 400, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
});
