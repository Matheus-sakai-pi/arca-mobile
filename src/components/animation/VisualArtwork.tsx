import { useCallback } from 'react';
import { AppState, Image, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Animated, { cancelAnimation, ReduceMotion, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useMotionPreference } from '@/hooks/useMotionPreference';
import { visualArtwork } from '@/constants/visualAssets';
import type { ArtworkKey } from '@/lib/visualContent';

export function VisualArtwork({ name, size = 112, animated = true }: { name: ArtworkKey; size?: number; animated?: boolean }) {
  const reduced = useMotionPreference();
  const lift = useSharedValue(0);
  useFocusEffect(useCallback(() => {
    lift.set(0);
    const stop = () => { cancelAnimation(lift); lift.set(0); };
    if (animated && !reduced && AppState.currentState === 'active') {
      const config = { duration: 550, reduceMotion: ReduceMotion.System };
      lift.set(withRepeat(withSequence(withTiming(-4, config), withTiming(0, config)), 2, false, undefined, ReduceMotion.System));
    }
    const subscription = AppState.addEventListener('change', state => { if (state !== 'active') stop(); });
    return () => { subscription.remove(); stop(); };
  }, [animated, reduced, lift]));
  const motion = useAnimatedStyle(() => ({ transform: [{ translateY: lift.get() }] }));
  return <View testID={`visual-art-${name}`} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden style={[styles.bounds, { width: size, height: size }]}><Animated.View style={[styles.fill, motion]}><Image source={visualArtwork[name]} resizeMode="contain" style={styles.fill} /></Animated.View></View>;
}
const styles = StyleSheet.create({ bounds: { alignSelf: 'center', maxWidth: '100%', flexShrink: 0 }, fill: { width: '100%', height: '100%' } });
