import type { TextStyle } from 'react-native';

export const fonts = { regular: 'Nunito_400Regular', medium: 'Nunito_600SemiBold', bold: 'Nunito_700Bold', heavy: 'Nunito_800ExtraBold' } as const;
export const typography = {
  display: { fontFamily: fonts.heavy, fontSize: 36, lineHeight: 43 },
  h1: { fontFamily: fonts.heavy, fontSize: 30, lineHeight: 37 },
  h2: { fontFamily: fonts.heavy, fontSize: 24, lineHeight: 31 },
  h3: { fontFamily: fonts.bold, fontSize: 19, lineHeight: 26 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24 },
  small: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21 },
  label: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 19 },
  button: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 24 },
} satisfies Record<string, TextStyle>;
