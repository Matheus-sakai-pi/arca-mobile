import { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { colors, layout, radius } from '@/constants/theme';
import { redesignAssets } from '@/constants/redesignAssets';
import { useMotionPreference } from '@/hooks/useMotionPreference';

export type MascotState = 'idle' | 'happy' | 'celebrating' | 'thinking' | 'reading' | 'encouraging' | 'wrong_answer' | 'streak' | 'lesson_complete';
const idle = require('../../../assets/mascot/idle.png');
const thinking = require('../../../assets/mascot/thinking-v2.png');
const encouraging = require('../../../assets/mascot/encouraging-v2.png');
const happy = require('../../../assets/mascot/correct-v2.png');
const reading = redesignAssets.reading;
const celebrating = require('../../../assets/mascot/celebrating.png');
const assets: Record<MascotState, typeof idle> = { idle, happy, celebrating, thinking, reading, encouraging, wrong_answer: encouraging, streak: celebrating, lesson_complete: celebrating };
const labels: Record<MascotState,string> = { idle:'acenando',happy:'feliz',celebrating:'comemorando',thinking:'pensando',reading:'com um livro aberto',encouraging:'encorajando',wrong_answer:'encorajando',streak:'comemorando',lesson_complete:'comemorando a conclusão' };

export function Mascot({ state = 'idle', size = layout.mascot, backdrop = false, animated = false, motionKey, decorative = false }: { state?: MascotState; size?: number; backdrop?: boolean; animated?: boolean; motionKey?: string | number; decorative?: boolean }) {
  const reduced = useMotionPreference();
  const lift = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(lift);
    lift.set(0);
    if (animated && !reduced) lift.set(withSequence(withTiming(-5, { duration: 160 }), withTiming(0, { duration: 220 })));
    return () => cancelAnimation(lift);
  }, [animated, reduced, state, motionKey, lift]);
  const motion = useAnimatedStyle(() => ({ transform: [{ translateY: lift.get() }] }));
  return <View testID={`mascot-${state}`} style={[styles.container, { width: size, height: size }, backdrop && styles.backdrop]}><Animated.View style={[styles.image, motion]}><Image accessible={!decorative} accessibilityLabel={`Mascote do Arca, um sábio de barba branca ${labels[state]}`} source={assets[state]} resizeMode="contain" style={styles.image} /></Animated.View></View>;
}
const styles = StyleSheet.create({ container: { alignItems: 'center', justifyContent: 'center', alignSelf: 'center', maxWidth: '100%', aspectRatio: 1 }, image: { width: '100%', height: '100%' }, backdrop: { backgroundColor: colors.primarySoft, borderRadius: radius.xl } });
