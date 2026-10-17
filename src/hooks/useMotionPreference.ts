import { useReducedMotion } from 'react-native-reanimated';
import { usePreferences } from '@/providers/PreferencesProvider';
export function useMotionPreference() { const system=useReducedMotion(); return usePreferences().reduceMotion || system; }
