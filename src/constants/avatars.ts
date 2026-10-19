import type { ImageSourcePropType } from 'react-native';
import { resolveAvatarKey, type AvatarKey } from './avatarKeys';
export { avatarOptions } from './avatarKeys';
const sources: Record<AvatarKey, ImageSourcePropType> = {
  'avatar-01': require('../../assets/avatars/avatar-01.png'),
  'avatar-02': require('../../assets/avatars/avatar-02.png'),
  'avatar-03': require('../../assets/avatars/avatar-03.png'),
  'avatar-04': require('../../assets/avatars/avatar-04.png'),
  'avatar-05': require('../../assets/avatars/avatar-05.png'),
  owl: require('../../assets/characters/owl.png'),
  lamb: require('../../assets/characters/lamb.png'),
  fox: require('../../assets/characters/fox.png'),
  dove: require('../../assets/characters/dove.png'),
  turtle: require('../../assets/characters/turtle.png'),
  'vip-sage': require('../../assets/avatars/vip-sage.png'),
  'vip-explorer': require('../../assets/avatars/vip-explorer.png'),
};
export function getAvatarSource(key: unknown): ImageSourcePropType { return sources[resolveAvatarKey(key)]; }
