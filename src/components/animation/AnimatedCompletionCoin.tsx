import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, ReduceMotion, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useMotionPreference } from '@/hooks/useMotionPreference';
import { TrailCoin } from '@/components/learning/TrailCoin';
import type { LessonStatus } from '@/types/learning';
import { useCompletionMotion, useRewardMotion } from '@/providers/RewardMotionProvider';
import { useVisibleInScroll } from './ScrollVisibility';
export function AnimatedCompletionCoin({lessonId,status,color='#0964FF'}: {lessonId:string;status:LessonStatus;color?:string}) {
  const {coins,achievements,ledger}=useRewardMotion();
  const event=coins[lessonId];
  const {target,visible}=useVisibleInScroll(!!event && !ledger.wasClaimed(`coin:${lessonId}`,event));
  const trigger=useCompletionMotion(lessonId,visible && !achievements?.pending.length);
  const reduced=useMotionPreference();
  const scale=useSharedValue(1),turn=useSharedValue(0),reveal=useSharedValue(1),glow=useSharedValue(0);
  useEffect(()=>{
    if(!trigger || status !== 'completed' || reduced) return;
    const config={duration:160,reduceMotion:ReduceMotion.System};
    reveal.set(0);reveal.set(withTiming(1,{duration:420,reduceMotion:ReduceMotion.System}));
    scale.set(withSequence(withTiming(1.08,config),withTiming(1,{...config,duration:260})));
    turn.set(withSequence(withTiming(-7,config),withTiming(0,{...config,duration:260})));
    glow.set(withSequence(withTiming(0.45,config),withTiming(0,{...config,duration:300})));
    return()=>{cancelAnimation(reveal);cancelAnimation(scale);cancelAnimation(turn);cancelAnimation(glow);};
  },[trigger,status,reduced,reveal,scale,turn,glow]);
  const movement=useAnimatedStyle(()=>({transform:[{scale:scale.get()},{rotate:`${turn.get()}deg`}]}));
  const opacity=useAnimatedStyle(()=>({opacity:reveal.get()}));
  const highlight=useAnimatedStyle(()=>({opacity:glow.get()}));
  return <View ref={target} collapsable={false} style={styles.frame}><Animated.View accessible={false} style={[styles.frame,movement,status === 'completed' && opacity]}><TrailCoin lessonId={lessonId} status={status} color={color} /><Animated.View pointerEvents="none" style={[styles.shine,highlight]}><View style={styles.gleam} /></Animated.View></Animated.View></View>;
}
const styles=StyleSheet.create({frame:{width:96,height:96},shine:{position:'absolute',top:0,right:0,bottom:0,left:0,borderRadius:48,backgroundColor:'rgba(225,239,255,0.45)',alignItems:'center',justifyContent:'center'},gleam:{width:48,height:3,backgroundColor:'white',transform:[{rotate:'-35deg'}]}});
