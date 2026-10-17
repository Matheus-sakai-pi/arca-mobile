import type { ImageSourcePropType } from 'react-native';
import type { LessonStatus } from '@/types/learning';

export const trailCoins: Record<LessonStatus, ImageSourcePropType> = {
  available: require('../../assets/ui/trail-coin-blue.png'),
  completed: require('../../assets/ui/trail-coin-blue.png'),
  current: require('../../assets/ui/trail-coin-blue.png'),
  locked: require('../../assets/ui/trail-coin-gray.png'),
};
