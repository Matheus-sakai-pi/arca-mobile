import { useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type ScrollViewProps, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '@/constants/theme';
import { ScrollVisibilityContext } from '@/components/animation/ScrollVisibility';
import { IllustratedBackground } from './IllustratedBackground';
import { ScrollingIllustration } from './ScrollingIllustration';

export function Screen({ children, style, footer, header, backgroundColor, background, scene, sceneScrolls = false, backgroundBlur = 0, refreshControl, keyboard = false, resetScrollKey }: PropsWithChildren<{ style?: StyleProp<ViewStyle>; footer?: React.ReactNode; header?: React.ReactNode; backgroundColor?: string; background?: React.ReactNode; scene?: 'ark' | 'valley'; sceneScrolls?: boolean; backgroundBlur?: number; keyboard?: boolean; refreshControl?: ScrollViewProps['refreshControl'];resetScrollKey?:string }>) {
  const scroll=useRef<ScrollView>(null);
  const viewport=useRef<View>(null);
  const [listeners]=useState(()=>new Set<()=>void>());
  const [visibility]=useState(()=>({subscribe:(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};},measureBounds:(callback:(top:number,height:number)=>void)=>viewport.current?.measureInWindow((_x,y,_width,height)=>callback(y,height))}));
  useEffect(()=>{if(resetScrollKey) scroll.current?.scrollTo({y:0,animated:false});},[resetScrollKey]);
  return (
    <SafeAreaView testID={scene && !sceneScrolls ? 'continuous-scene-screen' : undefined} edges={['top', 'left', 'right']} style={[styles.safe, backgroundColor ? { backgroundColor } : undefined]}>
      {scene ? !sceneScrolls ? <IllustratedBackground scene={scene} blurRadius={backgroundBlur} /> : null : background}
      <KeyboardAvoidingView style={styles.flex} behavior={keyboard && Platform.OS === 'ios' ? 'padding' : undefined}>
        {header}
        <View ref={viewport} collapsable={false} style={styles.flex}><ScrollView ref={scroll} testID={sceneScrolls ? 'illustrated-scroll' : scene ? 'continuous-scene-scroll' : undefined} style={styles.flex} contentContainerStyle={[styles.content, style]} refreshControl={refreshControl} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} scrollEventThrottle={100} onScroll={()=>listeners.forEach(listener=>listener())} onContentSizeChange={()=>listeners.forEach(listener=>listener())}>
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
