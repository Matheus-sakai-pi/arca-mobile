import { Image } from 'react-native';
import { visualArtwork } from '@/constants/visualAssets';

export function BatteryIcon({ size = 32 }: { size?: number }) {
  return (
    <Image
      testID="battery-icon"
      source={visualArtwork.energy}
      resizeMode="contain"
      accessible={false}
      style={{ width: size, height: (size * 2) / 3 }}
    />
  );
}
