import { useCallback, useEffect } from 'react';
import Animated, {
  cancelAnimation,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useMotionPreference } from '@/hooks/useMotionPreference';
import type { NumberTransition } from '@/lib/motionEvents';
import { rewardHaptic } from '@/lib/rewardHaptics';
import { AnimatedNumber, type AnimatedNumberProps } from './AnimatedNumber';

export function AnimatedCounter({
  transition,
  bounce = false,
  haptic = false,
  onComplete,
  ...props
}: Omit<AnimatedNumberProps, 'from' | 'to'> & {
  transition: NumberTransition;
  bounce?: boolean;
  haptic?: boolean;
}) {
  const scale = useSharedValue(1);
  const reduced = useMotionPreference();
  useEffect(() => () => cancelAnimation(scale), [scale]);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const finish = useCallback(() => {
    if (transition.event && transition.to > transition.from) {
      if (bounce && !reduced) {
        cancelAnimation(scale);
        scale.set(
          withSequence(
            withTiming(1.07, { duration: 100, reduceMotion: ReduceMotion.System }),
            withTiming(1, { duration: 160, reduceMotion: ReduceMotion.System }),
          ),
        );
      }
      if (haptic) rewardHaptic();
    }
    onComplete?.();
  }, [transition, bounce, haptic, reduced, scale, onComplete]);
  return (
    <Animated.View style={animated}>
      <AnimatedNumber {...props} from={transition.from} to={transition.to} onComplete={finish} />
    </Animated.View>
  );
}
