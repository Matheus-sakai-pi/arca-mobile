import { useCallback, useEffect, useMemo } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Asset } from 'expo-asset';
import { soundEffectsConfig } from '@/constants/sounds';
import { usePreferences } from '@/providers/PreferencesProvider';
import { createFeedbackPlayback } from '@/lib/feedbackPlayback';
import { createWebFeedbackPlayer } from '@/lib/webFeedbackPlayer';

export function useLessonSounds(enabledOverride?: boolean) {
  const { soundEnabled } = usePreferences();
  const enabled = enabledOverride ?? soundEnabled;
  const players = useMemo(() => {
    const player = (source: number) => createWebFeedbackPlayer(
      typeof Audio === 'undefined' ? null : new Audio(),
      Asset.fromModule(source).uri, soundEffectsConfig.volume,
    );
    return { correct: player(soundEffectsConfig.sources.correct), wrong: player(soundEffectsConfig.sources.wrong) };
  }, []);
  const playback = useMemo(() => createFeedbackPlayback(players, async () => {}, {
    onError: (sound, error) => { if (__DEV__) console.warn(`[arca.audio.${sound}] Falha ao reproduzir efeito:`, error); },
  }), [players]);
  useEffect(() => {
    players.correct.reload?.(); players.wrong.reload?.();
    return () => { playback.setActive(false); players.correct.dispose(); players.wrong.dispose(); };
  }, [players, playback]);
  useEffect(() => { playback.setEnabled(enabled); }, [enabled, playback]);
  useFocusEffect(useCallback(() => {
    playback.setActive(AppState.currentState === null || AppState.currentState === 'active');
    const listener = AppState.addEventListener('change', state => playback.setActive(state === 'active'));
    return () => { listener.remove(); playback.setActive(false); };
  }, [playback]));
  return playback.play;
}
