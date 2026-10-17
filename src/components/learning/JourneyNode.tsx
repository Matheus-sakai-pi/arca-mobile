import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { AppText } from '@/components/common/AppText';
import type { LessonStatus } from '@/types/learning';
import { AnimatedCompletionCoin } from '@/components/animation/AnimatedCompletionCoin';
import { useMotionPreference } from '@/hooks/useMotionPreference';

const labels: Record<LessonStatus, string> = { completed: 'Concluída', current: 'Atual', available: 'Disponível', locked: 'Bloqueada' };
const circumference = 2 * Math.PI * 53;
export function JourneyNode({ title, lessonId, status, color = '#0964FF', percent = 0, onPress }: { title: string; lessonId: string; status: LessonStatus; color?: string; percent?: number; onPress: () => void }) {
  const offset = useSharedValue(0);
  const reduced = useMotionPreference();
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.get() }] }));
  const canStart = status === 'current' || status === 'available';
  const value = Math.max(0, Math.min(100, percent));
  function press() {
    if (status === 'locked') {
      const config = { duration: 60, reduceMotion: reduced ? ReduceMotion.Always : ReduceMotion.System };
      offset.set(withSequence(withTiming(-3, config), withTiming(3, config), withTiming(-2, config), withTiming(0, config)));
    }
    onPress();
  }
  return <Animated.View style={[styles.frame, animatedStyle]}>
    {canStart ? <View testID={`journey-start-${lessonId}`} pointerEvents="none" style={[styles.bubble, { borderColor: color }]}><AppText variant="label" color="#172234">COMEÇAR</AppText><View style={[styles.tail, { borderTopColor: color }]} /></View> : null}
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}, ${labels[status]}`} accessibilityHint={status === 'locked' ? 'Mostra qual lição precisa ser concluída para liberar este passo.' : canStart ? `${value}% da lição concluído. Abrir lição.` : 'Rever lição'} onPress={press} style={({ pressed }) => [styles.press, pressed && styles.pressed]}>
      <AnimatedCompletionCoin lessonId={lessonId} status={status} color={color} />
    </Pressable>
    {canStart ? <View testID={`journey-progress-${lessonId}`} pointerEvents="none" accessibilityRole="progressbar" accessibilityLabel={`Progresso de ${title}`} accessibilityValue={{ min: 0, max: 100, now: value }} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} style={styles.progress}>
      <Svg width={116} height={116} viewBox="0 0 116 116"><Circle cx={58} cy={58} r={53} stroke="#E9EDF2" strokeWidth={6} fill="none" /><Circle testID={`journey-progress-arc-${lessonId}`} cx={58} cy={58} r={53} stroke={color} strokeWidth={6} fill="none" strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={circumference * (1 - value / 100)} strokeLinecap={value > 0 ? 'round' : 'butt'} transform="rotate(-90 58 58)" /></Svg>
    </View> : null}
  </Animated.View>;
}
const styles = StyleSheet.create({
  frame: { width: 116, height: 116, alignItems: 'center', justifyContent: 'center' },
  press: { width: 104, height: 104, alignItems: 'center', justifyContent: 'center', borderRadius: 52 },
  pressed: { opacity: 0.8, transform: [{ translateY: 3 }] },
  progress: { position: 'absolute', top: 0, left: 0, width: 116, height: 116 },
  bubble: { position: 'absolute', top: -33, minWidth: 112, height: 30, paddingHorizontal: 12, backgroundColor: '#FFFFFF', borderWidth: 2, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  tail: { position: 'absolute', bottom: -7, borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 6, borderLeftColor: 'transparent', borderRightColor: 'transparent' },
});
