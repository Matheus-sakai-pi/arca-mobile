import { Image, StyleSheet } from 'react-native';
import { getAvatarSource } from '@/constants/avatars';
import { colors } from '@/constants/theme';
import { photoAvatarId } from '@/lib/profilePhoto';
import { PhotoAvatar } from './PhotoAvatar';
export function Avatar({
  avatarKey,
  size = 48,
  label,
}: {
  avatarKey?: string | null;
  size?: number;
  label?: string;
}) {
  const photo = photoAvatarId(avatarKey);
  if (photo) return <PhotoAvatar id={photo} size={size} label={label} />;
  return (
    <Image
      source={getAvatarSource(avatarKey)}
      resizeMode="cover"
      resizeMethod="resize"
      accessibilityLabel={label}
      accessible={!!label}
      style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
    />
  );
}
const styles = StyleSheet.create({ image: { backgroundColor: colors.primarySoft } });
