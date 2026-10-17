import type { ImageSourcePropType } from 'react-native';
import type { AchievementId } from '@/lib/achievements';

export const achievementArtwork = {
  first_step: require('../../assets/achievements/first-step.png'),
  perfect_lesson: require('../../assets/achievements/perfect-lesson.png'),
  streak_3: require('../../assets/achievements/streak-3.png'),
  streak_7: require('../../assets/achievements/streak-7.png'),
  scholar: require('../../assets/achievements/scholar.png'),
  unit_1: require('../../assets/achievements/unit-1.png'),
  unit_2: require('../../assets/achievements/unit-2.png'),
  xp_500: require('../../assets/achievements/xp-500.png'),
  xp_1000: require('../../assets/achievements/xp-1000.png'),
} satisfies Record<AchievementId, ImageSourcePropType>;
