import { useEffect, useRef, useState } from 'react';
import { StyleSheet, type StyleProp, type TextStyle, View } from 'react-native';
import { cancelAnimation, Easing, ReduceMotion, useAnimatedReaction, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useMotionPreference } from '@/hooks/useMotionPreference';
import { scheduleOnRN } from 'react-native-worklets';
import { colors, typography } from '@/constants/theme';
import { AppText } from '@/components/common/AppText';

export type AnimatedNumberProps={from?:number;to:number;duration?:number;delay?:number;prefix?:string;suffix?:string;decimals?:number;onComplete?:()=>void;variant?:keyof typeof typography;color?:string;style?:StyleProp<TextStyle>};
export function AnimatedNumber({from,to,duration=800,delay=0,prefix='',suffix='',decimals=0,onComplete,variant='body',color=colors.text,style}:AnimatedNumberProps) {
  const reduced=useMotionPreference();
  const target=Number.isFinite(to) ? to : 0;
  const start=from !== undefined && Number.isFinite(from) ? from : target;
  const digits=Math.max(0,Math.min(4,Math.round(decimals)));
  const value=useSharedValue(reduced ? target : start);
  const [displayedValue,setDisplayedValue]=useState(reduced ? target : start);
  const callback=useRef(onComplete);
  const generation=useRef(0);
  useEffect(()=>{callback.current=onComplete;},[onComplete]);
  const completed=useRef((version:number)=>{if(generation.current === version) callback.current?.();});
  useEffect(()=>{
    const version=++generation.current;
    cancelAnimation(value);
    value.set(reduced ? target : start);
    if(start !== target) {
      if(reduced) completed.current(version);
      else {
        const finish=completed.current;
        value.set(withDelay(Math.max(0,delay),withTiming(target,{duration:Math.max(0,duration),easing:Easing.out(Easing.cubic),reduceMotion:ReduceMotion.System},finished=>{if(finished) scheduleOnRN(finish,version);}),ReduceMotion.System));
      }
    }
    return()=>{generation.current=version+1;cancelAnimation(value);};
  },[start,target,duration,delay,reduced,value]);
  // Render normal Text on every platform; only rounded number changes cross to React.
  useAnimatedReaction(()=>Number(value.get().toFixed(digits)),(next,previous)=>{if(next !== previous) scheduleOnRN(setDisplayedValue,next);},[digits,value]);
  const final=`${prefix}${target.toFixed(digits)}${suffix}`;
  const initial=`${prefix}${start.toFixed(digits)}${suffix}`;
  const reserved=initial.length > final.length ? initial : final;
  return <View accessible accessibilityRole="text" accessibilityLabel={final} style={styles.frame}><AppText accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden variant={variant} style={[styles.digits,style,styles.measure]}>{reserved}</AppText><AppText testID="animated-number-value" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden variant={variant} color={color} style={[styles.digits,style,styles.value]}>{prefix}{displayedValue.toFixed(digits)}{suffix}</AppText></View>;
}
const styles=StyleSheet.create({frame:{maxWidth:'100%',flexShrink:1},digits:{fontVariant:['tabular-nums']},measure:{opacity:0},value:{position:'absolute',top:0,bottom:0,left:0,right:0}});
