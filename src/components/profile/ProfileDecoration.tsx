import { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Crown, Leaf, Sparkles } from '@/components/icons';
import Animated, {
  cancelAnimation,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Avatar } from './Avatar';
import { AppText } from '@/components/common/AppText';
import { useMotionPreference } from '@/hooks/useMotionPreference';
import { profileArtwork } from '@/constants/profileArtwork';
import { profileFrames, type ProfileBackground, type ProfileFrame } from '@/lib/profileAppearance';

export function ProfileCover({ background }: { background: ProfileBackground }) {
  const source = profileArtwork[background];
  return source ? (
    <Image
      testID={'profile-cover-' + background}
      source={source}
      resizeMode="cover"
      accessible={false}
      style={styles.cover}
    />
  ) : null;
}
export function ProfileAvatar({
  avatarKey,
  frame = 'classic',
  size = 124,
  label,
  animate = true,
}: {
  avatarKey?: string | null;
  frame?: ProfileFrame;
  size?: number;
  label?: string;
  animate?: boolean;
}) {
  const reduced = useMotionPreference();
  const shine = useSharedValue(0.5);
  useEffect(() => {
    cancelAnimation(shine);
    shine.set(0.8);
    if (frame !== 'classic' && animate && !reduced) {
      const options = { duration: 850, reduceMotion: ReduceMotion.System };
      shine.set(withRepeat(withSequence(withTiming(0.25, options), withTiming(1, options)), 3, false));
    }
    return () => cancelAnimation(shine);
  }, [frame, animate, reduced, shine]);
  const glint = useAnimatedStyle(() => ({ opacity: shine.get() }));
  const color = profileFrames.find(option => option.key === frame)!.color;
  const decorated = frame !== 'classic';
  return (
    <View
      testID={'profile-frame-' + frame}
      style={[
        styles.frame,
        { borderColor: color, padding: decorated ? 6 : 5, borderWidth: decorated ? 4 : 2 },
      ]}
    >
      <Avatar avatarKey={avatarKey} size={size} label={label} />
      {frame === 'laurel' ? (
        <>
          <View pointerEvents="none" style={[styles.leaf, styles.leftLeaf]}>
            <Leaf size={Math.max(16, size / 4)} color="#167451" fill="#D9F4D9" strokeWidth={2.5} />
          </View>
          <View pointerEvents="none" style={[styles.leaf, styles.rightLeaf]}>
            <Leaf size={Math.max(16, size / 4)} color="#167451" fill="#D9F4D9" strokeWidth={2.5} />
          </View>
        </>
      ) : null}
      {decorated ? (
        <Animated.View pointerEvents="none" accessible={false} style={[styles.spark, glint]}>
          <Sparkles size={Math.max(17, size / 5)} color={color} fill="#FFFFFF" strokeWidth={2} />
        </Animated.View>
      ) : null}
    </View>
  );
}
export function VIPBadge() {
  return (
    <View testID="profile-vip-badge" accessible accessibilityLabel="Arca VIP" style={styles.badge}>
      <Crown size={13} color="#805600" fill="#F4CD68" />
      <AppText style={styles.badgeText}>VIP</AppText>
    </View>
  );
}
const styles = StyleSheet.create({
  cover: { position: 'absolute', top: 0, left: 0, right: 0, height: 164, width: '100%' },
  frame: {
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    boxShadow: '0 4px 12px rgba(35,55,80,0.12)',
  },
  spark: {
    position: 'absolute',
    top: -8,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    padding: 2,
  },
  leaf: { position: 'absolute', bottom: 0, backgroundColor: '#FFFFFF', borderRadius: 30 },
  leftLeaf: { left: -8, transform: [{ rotate: '-55deg' }] },
  rightLeaf: { right: -8, transform: [{ rotate: '25deg' }] },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF3CE',
    borderColor: '#E8C975',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  badgeText: { fontSize: 11, lineHeight: 15, color: '#805600', fontWeight: '800' },
});
