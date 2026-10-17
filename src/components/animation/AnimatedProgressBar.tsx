import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useMotionPreference } from '@/hooks/useMotionPreference';
import { colors, radius } from '@/constants/theme';
export function AnimatedProgressBar({value,from,duration=280,delay=0,label,compact=false}: {value:number;from?:number;duration?:number;delay?:number;label:string;compact?:boolean}) {
  const clamp=(n:number)=>Number.isFinite(n) ? Math.max(0,Math.min(100,n)) : 0;
  const percent=clamp(value);
  const reduced=useMotionPreference();
  const displayed=useSharedValue(reduced ? percent : clamp(from ?? percent));
  useEffect(()=>{
    if(reduced) displayed.set(percent);
    else {
      if(from !== undefined) displayed.set(Math.max(0,Math.min(100,from)));
      displayed.set(withDelay(delay,withTiming(percent,{duration,easing:Easing.out(Easing.cubic),reduceMotion:ReduceMotion.System}),ReduceMotion.System));
    }
    return()=>cancelAnimation(displayed);
  },[percent,from,duration,delay,reduced,displayed]);
  const animated=useAnimatedStyle(()=>({width:`${displayed.get()}%` as `${number}%`}));
  return <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{min:0,max:100,now:percent}} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} style={[styles.track,compact && styles.compactTrack]}><Animated.View style={[styles.fill,compact && styles.compactFill,animated]}>{!compact ? <View style={styles.highlight} /> : null}</Animated.View></View>;
}
const styles=StyleSheet.create({track:{height:16,width:'100%',backgroundColor:colors.track,borderRadius:radius.pill,overflow:'hidden',borderWidth:2,borderColor:colors.surface},compactTrack:{height:8,borderWidth:0,backgroundColor:'#D8E3F1'},compactFill:{paddingTop:0},fill:{height:'100%',backgroundColor:colors.primary,borderRadius:radius.pill,paddingTop:2},highlight:{height:3,marginHorizontal:4,borderRadius:radius.pill,backgroundColor:'rgba(255,255,255,0.45)'}});
