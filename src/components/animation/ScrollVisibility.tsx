import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect } from 'expo-router';

export type ScrollVisibility = {
  subscribe: (listener: () => void) => () => void;
  measureBounds: (callback: (top: number, height: number) => void) => void;
};
export const ScrollVisibilityContext = createContext<ScrollVisibility | null>(null);
export function useVisibleInScroll(active: boolean) {
  const target = useRef<View>(null);
  const context = useContext(ScrollVisibilityContext);
  const [visible, setVisible] = useState(false);
  useFocusEffect(
    useCallback(() => {
      if (!active) return;
      let alive = true;
      const measure = () =>
        context?.measureBounds((top, height) =>
          target.current?.measureInWindow((_x, y, _width, nodeHeight) => {
            if (alive) setVisible(y >= top && y + nodeHeight <= top + height);
          }),
        );
      measure();
      const unsubscribe = context?.subscribe(measure);
      return () => {
        alive = false;
        unsubscribe?.();
        setVisible(false);
      };
    }, [active, context]),
  );
  return { target, visible };
}
