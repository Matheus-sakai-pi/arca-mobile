import { useEffect, type PropsWithChildren } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { cancelAnimation, ReduceMotion, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useMotionPreference } from '@/hooks/useMotionPreference';
export function RewardPulse({event,children,glow=false,motion='pulse'}:PropsWithChildren<{event:number|string;glow?:boolean;motion?:'pulse'|'rise'|'tilt'}>) {
  const scale=useSharedValue(1);
  const light=useSharedValue(0);
  const accent=useSharedValue(0);
  const reduced=useMotionPreference();
  useEffect(()=>{
    cancelAnimation(scale);cancelAnimation(light);cancelAnimation(accent);
    scale.set(1);light.set(0);accent.set(0);
    if(!event || reduced) return;
    scale.set(withSequence(withTiming(1.14,{duration:130,reduceMotion:ReduceMotion.System}),withTiming(1,{duration:200,reduceMotion:ReduceMotion.System})));
    if(glow) light.set(withSequence(withTiming(0.45,{duration:130,reduceMotion:ReduceMotion.System}),withTiming(0,{duration:240,reduceMotion:ReduceMotion.System})));
    if(motion === 'rise') accent.set(withSequence(withTiming(-8,{duration:150,reduceMotion:ReduceMotion.System}),withTiming(0,{duration:220,reduceMotion:ReduceMotion.System})));
    if(motion === 'tilt') accent.set(withSequence(withTiming(-5,{duration:100,reduceMotion:ReduceMotion.System}),withTiming(5,{duration:160,reduceMotion:ReduceMotion.System}),withTiming(0,{duration:100,reduceMotion:ReduceMotion.System})));
    return()=>{cancelAnimation(scale);cancelAnimation(light);cancelAnimation(accent);};
  },[event,reduced,scale,light,glow,motion,accent]);
  const animated=useAnimatedStyle(()=>({transform:[{scale:scale.get()},{translateY:motion === 'rise' ? accent.get() : 0},{rotate:`${motion === 'tilt' ? accent.get() : 0}deg`}]}));
  const shine=useAnimatedStyle(()=>({opacity:light.get()}));
  return <Animated.View style={animated}>{children}{glow ? <Animated.View pointerEvents="none" style={[styles.glow,shine]} /> : null}</Animated.View>;
}
const styles=StyleSheet.create({glow:{position:'absolute',top:0,left:0,right:0,bottom:0,borderRadius:100,backgroundColor:'rgba(255,255,255,0.6)'}});
