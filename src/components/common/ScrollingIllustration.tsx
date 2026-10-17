import { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { colors } from '@/constants/theme';
import { IllustratedBackground } from './IllustratedBackground';

export function ScrollingIllustration({ scene, blurRadius }: { scene: 'ark' | 'valley'; blurRadius: number }) {
  const fadeId = useId().replace(/:/g, '');
  return <View testID="scrolling-illustration" pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.scene}>
    <IllustratedBackground scene={scene} blurRadius={blurRadius} />
    <View style={styles.fade}><Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
      <Defs><LinearGradient id={fadeId} x1="0" y1="0" x2="0" y2="1"><Stop offset={0} stopColor={colors.background} stopOpacity={0} /><Stop offset={1} stopColor={colors.background} stopOpacity={1} /></LinearGradient></Defs>
      <Rect width={100} height={100} fill={`url(#${fadeId})`} />
    </Svg></View>
  </View>;
}
const styles = StyleSheet.create({
  // Edge constraints also fill the ScrollView padding box on native layouts.
  scene: { position: 'absolute', top: 0, left: 0, right: 0, aspectRatio: 2 / 3, overflow: 'hidden' },
  fade: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 128 },
});
