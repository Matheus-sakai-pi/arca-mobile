import { Text, type TextProps } from 'react-native';
import { colors, typography } from '@/constants/theme';

type Props = TextProps & { variant?: keyof typeof typography; color?: string };
export function AppText({ variant = 'body', color = colors.text, style, ...props }: Props) {
  return <Text {...props} maxFontSizeMultiplier={1.6} style={[typography[variant], { color, letterSpacing: 0 }, style]} />;
}
