import { Image, StyleSheet, View } from 'react-native';
import { redesignAssets } from '@/constants/redesignAssets';

export function IllustratedBackground({
  scene = 'ark',
  blurRadius = 0,
}: {
  scene?: 'ark' | 'valley';
  blurRadius?: number;
}) {
  return (
    <View
      testID="illustrated-background"
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.background}
    >
      <Image source={redesignAssets[scene]} resizeMode="cover" blurRadius={blurRadius} style={styles.image} />
      <View style={styles.veil} />
    </View>
  );
}
const styles = StyleSheet.create({
  background: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ECF4FF',
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
  veil: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(244,249,255,0.08)',
  },
});
