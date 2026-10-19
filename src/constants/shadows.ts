import type { ViewStyle } from 'react-native';
export const shadows = {
  soft: { boxShadow: 'none' },
  button: { boxShadow: '0 5px 12px rgba(46, 107, 239, 0.23)' },
  navigation: { boxShadow: '0 -4px 24px rgba(44, 42, 67, 0.09)' },
} satisfies Record<string, ViewStyle>;
