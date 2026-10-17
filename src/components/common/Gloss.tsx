import { useId, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

export function Gloss({ colors = ['#0A48ED', '#1188FF', '#20CDFF'], streak = false }: { colors?: readonly [string, string, string]; streak?: boolean }) {
  const id = useId().replace(/:/g, '');
  const [size, setSize] = useState({ width: 0, height: 0 });
  function measure(event: LayoutChangeEvent) {
    const width = Math.ceil(event.nativeEvent.layout.width);
    const height = Math.ceil(event.nativeEvent.layout.height);
    setSize(previous => previous.width === width && previous.height === height ? previous : { width, height });
  }
  // Measure an unpadded overlay; percentage SVG bounds shrink inside padded Android buttons.
  return <View collapsable={false} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.fill} onLayout={measure}>
    {size.width > 0 && size.height > 0 ? <Svg width={size.width} height={size.height} preserveAspectRatio="none" viewBox="0 0 300 100">
    <Defs><LinearGradient id={id} x1="0" y1="1" x2="1" y2="0"><Stop offset={0} stopColor={colors[0]} /><Stop offset={0.62} stopColor={colors[1]} /><Stop offset={1} stopColor={colors[2]} /></LinearGradient></Defs>
    <Rect width="300" height="100" fill={`url(#${id})`} />
    <Path d="M 16 9 H 284" stroke="white" strokeOpacity={0.3} strokeWidth="4" strokeLinecap="round" />
    {streak ? <Path d="M 235 100 L 300 18 M 257 100 L 300 51" stroke="white" strokeOpacity={0.12} strokeWidth="9" strokeLinecap="round" /> : null}
    </Svg> : null}
  </View>;
}
const styles = StyleSheet.create({ fill: { position: 'absolute', top: 0, left: 0, bottom: 0, right: 0, pointerEvents: 'none' } });
