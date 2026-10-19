import { useCallback, useEffect, useRef, useState, type PropsWithChildren, type RefObject } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type ScrollViewProps, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '@/constants/theme';
import { ScrollVisibilityContext } from '@/components/animation/ScrollVisibility';
import { IllustratedBackground } from './IllustratedBackground';
import { ScrollingIllustration } from './ScrollingIllustration';

export function Screen({ children, style, footer, header, backgroundColor, background, scene, sceneScrolls = false, backgroundBlur = 0, refreshControl, keyboard = false, resetScrollKey, initialScrollTarget, animateInitialScroll = true }: PropsWithChildren<{ style?: StyleProp<ViewStyle>; footer?: React.ReactNode; header?: React.ReactNode; backgroundColor?: string; background?: React.ReactNode; scene?: 'ark' | 'valley'; sceneScrolls?: boolean; backgroundBlur?: number; keyboard?: boolean; refreshControl?: ScrollViewProps['refreshControl'];resetScrollKey?:string; initialScrollTarget?: RefObject<View | null>; animateInitialScroll?: boolean }>) {
  const scroll=useRef<ScrollView>(null);
  const viewport=useRef<View>(null);
  const scrollOffset=useRef(0);
  const initialPosition=useRef<{target?: RefObject<View | null>; done:boolean; animated:boolean}>({done:false,animated:animateInitialScroll});
  useEffect(()=>{initialPosition.current.animated=animateInitialScroll;},[animateInitialScroll]);
  const positionInitialTarget=useCallback(()=>{
    const position=initialPosition.current;
    const target=position.target?.current;
    if(!target || position.done) return;
    viewport.current?.measureInWindow((_x,top,_width,height)=>{
      if(height<=0) return;
      target.measureInWindow((_targetX,targetTop,_targetWidth,targetHeight)=>{
        if(position!==initialPosition.current || target!==position.target?.current || position.done || targetHeight<=0) return;
        position.done=true;
        if(targetTop>=top && targetTop+targetHeight<=top+height) return;
        // Measure the rendered row, including variable titles and trail milestones.
        const y=Math.max(0,scrollOffset.current+targetTop-top-height/4);
        scroll.current?.scrollTo({y,animated:position.animated});
      });
    });
  },[]);
  const [listeners]=useState(()=>new Set<()=>void>());
  const [visibility]=useState(()=>({subscribe:(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};},measureBounds:(callback:(top:number,height:number)=>void)=>viewport.current?.measureInWindow((_x,y,_width,height)=>callback(y,height))}));
  useEffect(()=>{
    const position={target:initialScrollTarget,done:false,animated:initialPosition.current.animated};
    initialPosition.current=position;
    if(resetScrollKey) { scrollOffset.current=0; scroll.current?.scrollTo({y:0,animated:false}); }
    const frame=requestAnimationFrame(positionInitialTarget);
    return ()=>{position.done=true;cancelAnimationFrame(frame);};
  },[resetScrollKey,initialScrollTarget,positionInitialTarget]);
  return (
    <SafeAreaView testID={scene && !sceneScrolls ? 'continuous-scene-screen' : undefined} edges={['top', 'left', 'right']} style={[styles.safe, backgroundColor ? { backgroundColor } : undefined]}>
      {scene ? !sceneScrolls ? <IllustratedBackground scene={scene} blurRadius={backgroundBlur} /> : null : background}
      <KeyboardAvoidingView style={styles.flex} behavior={keyboard && Platform.OS === 'ios' ? 'padding' : undefined}>
        {header}
        <View ref={viewport} collapsable={false} style={styles.flex} onLayout={positionInitialTarget}><ScrollView ref={scroll} testID={sceneScrolls ? 'illustrated-scroll' : scene ? 'continuous-scene-scroll' : initialScrollTarget ? 'current-lesson-scroll' : undefined} style={styles.flex} contentContainerStyle={[styles.content, style]} refreshControl={refreshControl} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} removeClippedSubviews={initialScrollTarget ? false : undefined} scrollEventThrottle={100} onScroll={event=>{scrollOffset.current=event.nativeEvent.contentOffset.y;listeners.forEach(listener=>listener());}} onScrollBeginDrag={()=>{initialPosition.current.done=true;}} onContentSizeChange={()=>{listeners.forEach(listener=>listener());positionInitialTarget();}}>
          {scene && sceneScrolls ? <ScrollingIllustration scene={scene} blurRadius={backgroundBlur} /> : null}
          <ScrollVisibilityContext.Provider value={visibility}>{children}</ScrollVisibilityContext.Provider>
        </ScrollView></View>
        {footer ? <SafeAreaView edges={['bottom']} style={[styles.footer, scene && styles.illustratedFooter]}><View style={styles.footerInner}>{footer}</View></SafeAreaView> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, padding: spacing.md, gap: spacing.lg },
  illustratedFooter: { backgroundColor: 'rgba(255,255,255,0.97)', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 0, boxShadow: '0 -4px 24px rgba(35,99,211,0.10)' },
  footer: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  footerInner: { padding: spacing.md, gap: spacing.xs },
});
