import { useEffect } from 'react';
import type { StyleProp, TextStyle } from 'react-native';
import Animated, { cancelAnimation, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useMotionPreference } from '@/hooks/useMotionPreference';
import { rankDirection } from '@/lib/motionEvents';
import { useCounterMotion } from '@/providers/RewardMotionProvider';
import { AnimatedCounter } from './AnimatedCounter';
import type { AnimatedNumberProps } from './AnimatedNumber';
export function AnimatedRankChange({position,motionKey,color,style,variant='label',prefix='#'}: {position:number;motionKey:string;color?:string;style?:StyleProp<TextStyle>;variant?:AnimatedNumberProps['variant'];prefix?:string}) {
  const transition=useCounterMotion(motionKey,position);
  const offset=useSharedValue(0);
  const reduced=useMotionPreference();
  useEffect(()=>{
    if(!transition.event || reduced) return;
    offset.set(rankDirection(transition.from,transition.to)*6);
    offset.set(withTiming(0,{duration:320,reduceMotion:ReduceMotion.System}));
    return()=>cancelAnimation(offset);
  },[transition,reduced,offset]);
  const animated=useAnimatedStyle(()=>({transform:[{translateY:offset.get()}]}));
  return <Animated.View style={animated}><AnimatedCounter transition={transition} prefix={prefix} duration={450} variant={variant} color={color} style={style} /></Animated.View>;
}
