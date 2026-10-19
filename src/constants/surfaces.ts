import type { ViewStyle } from 'react-native';
import { colors } from './colors';

// Estilo plano: cartões brancos com borda grossa, cantos bem arredondados e sem sombra.
// A versão "tactile" ganha uma base mais grossa embaixo, como os botões.
export const surfaces = {
  card: { backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.border, borderRadius: 20 },
  tactile: { backgroundColor: colors.surface, borderWidth: 2, borderBottomWidth: 5, borderColor: colors.border, borderRadius: 20 },
} satisfies Record<string, ViewStyle>;
