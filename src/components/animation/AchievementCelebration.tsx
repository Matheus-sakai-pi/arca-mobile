import { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { usePathname } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import Animated, { ZoomIn, ReduceMotion } from 'react-native-reanimated';
import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Notice } from '@/components/common/Notice';
import { AchievementIcon } from '@/components/profile/AchievementIcon';
import { RewardPulse } from './RewardPulse';
import { achievementDefinitions, type Achievement } from '@/lib/achievements';
import { rewardHaptic } from '@/lib/rewardHaptics';
import { useRewardMotion } from '@/providers/RewardMotionProvider';
import { useLearning } from '@/providers/LearningProvider';
import { colors, spacing } from '@/constants/theme';
import { useMotionPreference } from '@/hooks/useMotionPreference';
import { VisualBurst } from './VisualBurst';

export function AchievementCelebration() {
  const path=usePathname();
  const {achievements,dismissAchievement,achievementError}=useRewardMotion();
  const {activeLessonId}=useLearning();
  const [busy,setBusy]=useState(false);
  const id=achievements?.pending[0];
  const item=achievementDefinitions.find(entry=>entry.id === id);
  // Do not interrupt an exercise, result count-up, or authentication/import flow.
  const visible=!!item && !activeLessonId && ['/home','/learn','/ranking','/profile'].includes(path);
  async function dismiss() {if(!id || busy) return;setBusy(true);try {await dismissAchievement(id);} finally {setBusy(false);}}
  return <Modal visible={visible} transparent animationType="none" onRequestClose={()=>void dismiss()}><ScrollView style={styles.overlay} contentContainerStyle={styles.overlayContent} keyboardShouldPersistTaps="handled">{visible && item ? <AchievementCard key={item.id} item={item} error={achievementError} busy={busy} onContinue={()=>void dismiss()} /> : null}</ScrollView></Modal>;
}
function AchievementCard({item,error,busy,onContinue}: {item:Achievement;error:string|null;busy:boolean;onContinue:()=>void}) {
  const {ledger}=useRewardMotion();
  const reduced=useMotionPreference();
  useEffect(()=>{if(ledger.claim('achievement-haptic',item.id)) rewardHaptic();},[ledger,item.id]);
  return <Animated.View testID="achievement-celebration" accessibilityViewIsModal entering={ZoomIn.duration(220).reduceMotion(reduced ? ReduceMotion.Always : ReduceMotion.System)} style={styles.card}><VisualBurst event={`achievement:${item.id}`} /><AppText variant="label" color={colors.goldInk} style={styles.center}>Conquista desbloqueada!</AppText><RewardPulse event={item.id} glow motion={item.kind === 'streak' ? 'rise' : item.kind === 'unit' || item.kind === 'lessons' ? 'tilt' : 'pulse'}><View style={styles.art}><AchievementIcon id={item.id} size={152} /></View></RewardPulse><AppText variant="h2" style={styles.center}>{item.title}</AppText><AppText color={colors.muted} style={styles.center}>{item.description}</AppText>{error ? <Notice tone="error" message={error} /> : null}<Button title="Continuar" icon={ArrowRight} loading={busy} onPress={onContinue} /></Animated.View>;
}
const styles=StyleSheet.create({overlay:{flex:1,backgroundColor:'rgba(34,33,42,0.42)'},overlayContent:{flexGrow:1,alignItems:'center',justifyContent:'center',padding:spacing.lg},card:{width:'100%',maxWidth:360,borderRadius:8,backgroundColor:colors.surface,padding:spacing.lg,gap:spacing.md,borderWidth:1,borderColor:colors.gold,boxShadow:'0 12px 36px rgba(34,33,42,0.18)'},art:{width:152,height:152,alignSelf:'center'},center:{textAlign:'center'}});
