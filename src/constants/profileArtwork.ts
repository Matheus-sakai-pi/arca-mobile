import type { ImageSourcePropType } from 'react-native';
import type { ProfileBackground } from '@/lib/profileAppearance';

export const profileArtwork: Partial<Record<ProfileBackground, ImageSourcePropType>> = {
  garden: require('../../assets/profile/garden.png'),
  sky: require('../../assets/profile/sky.png'),
  stars: require('../../assets/profile/stars.png'),
};
