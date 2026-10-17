import type { ImageSourcePropType } from 'react-native';
import type { ArtworkKey } from '@/lib/visualContent';

export const visualArtwork = {
  friends: require('../../assets/visuals/friends.png'),
  review: require('../../assets/visuals/review.png'),
  history: require('../../assets/visuals/history.png'),
  challenge: require('../../assets/visuals/challenge.png'),
  energy: require('../../assets/icons/battery-pink.png'),
  waypoint: require('../../assets/visuals/waypoint.png'),
  streak: require('../../assets/visuals/streak.png'),
} satisfies Record<ArtworkKey, ImageSourcePropType>;
