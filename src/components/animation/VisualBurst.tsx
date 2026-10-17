import { useCallback } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Animated, { cancelAnimation, ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withTiming, type SharedValue } from 'react-native-reanimated';
import { useMotionPreference } from '@/hooks/useMotionPreference';
import { useRewardMotion } from '@/providers/RewardMotionProvider';
import { colors } from '@/constants/theme';

const palette = [colors.gold, colors.teal, colors.primary, '#F17F77'];
export function VisualBurst({ event, enabled = true }: { event: string; enabled?: boolean }) {
  const reduced = useMotionPreference();
  const { ledger } = useRewardMotion();
  const phase = useSharedValue(1);
  useFocusEffect(useCallback(() => {
    const stop = () => { cancelAnimation(phase); phase.set(1); };
    if (enabled && !reduced && AppState.currentState === 'active' && ledger.claim('visual-burst', event)) {
      phase.set(0);
      phase.set(withDelay(180, withTiming(1, { duration: 1300, reduceMotion: ReduceMotion.System }), ReduceMotion.System));
    }
    const subscription = AppState.addEventListener('change', state => { if (state !== 'active') stop(); });
    return () => { subscription.remove(); stop(); };
  }, [enabled, reduced, event, ledger, phase]));
  if (!enabled || reduced) return null;
  return <View testID="visual-celebration" pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden style={styles.bounds}>{Array.from({ length: 18 }, (_, index) => <Piece key={index} index={index} phase={phase} />)}</View>;
}
function Piece({ index, phase }: { index: number; phase: SharedValue<number> }) {
  const motion = useAnimatedStyle(() => {
    const value = phase.get();
    return { opacity: value < 0.03 || value >= 1 ? 0 : Math.min(1, (1 - value) * 4), transform: [{ translateY: value * (90 + index % 5 * 18) }, { translateX: Math.sin(value * Math.PI * 2 + index) * 12 }, { rotate: `${value * (index % 2 ? 230 : -230)}deg` }] };
  });
  return <Animated.View style={[styles.piece, { left: `${5 + index % 9 * 11}%`, backgroundColor: palette[index % palette.length] }, motion]} />;
}
const styles = StyleSheet.create({ bounds: { position: 'absolute', left: 0, right: 0, top: 0, height: 180, zIndex: 2, overflow: 'hidden' }, piece: { position: 'absolute', top: 4, width: 5, height: 9, borderRadius: 1 } });
