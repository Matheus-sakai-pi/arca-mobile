import { useEffect, useState, type PropsWithChildren } from 'react';
import Animated, { cancelAnimation, Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useMotionPreference } from '@/hooks/useMotionPreference';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useRewardMotion } from '@/providers/RewardMotionProvider';
export function PodiumEntrance({position,children}:PropsWithChildren<{position:1|2|3}>) {
  const {ledger}=useRewardMotion();
  const [enter,setEnter]=useState(false);
  const reduced=useMotionPreference();
  const progress=useSharedValue(1);
  useFocusEffect(useCallback(()=>{if(ledger.claim(`podium:${position}`,'session')) setEnter(true);},[ledger,position]));
  useEffect(()=>{
    if(!enter || reduced) return;
    progress.set(0);
    const delay=position === 2 ? 0 : position === 3 ? 100 : 220;
    progress.set(withDelay(delay,withTiming(1,{duration:420,easing:Easing.out(Easing.cubic),reduceMotion:ReduceMotion.System}),ReduceMotion.System));
    return()=>cancelAnimation(progress);
  },[enter,reduced,progress,position]);
  const animated=useAnimatedStyle(()=>({opacity:progress.get(),transform:[{translateY:(1-progress.get())*18},{scale:position === 1 ? 0.97+progress.get()*0.03 : 1}]}));
  return <Animated.View style={[{flex:1,minWidth:0,alignItems:'center'},animated]}>{children}</Animated.View>;
}
