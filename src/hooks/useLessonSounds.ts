import { useEffect, useMemo, useCallback } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { setAudioModeAsync, useAudioPlayer, type AudioPlayer } from 'expo-audio';
import { soundEffectsConfig } from '@/constants/sounds';
import { usePreferences } from '@/providers/PreferencesProvider';
import { createFeedbackPlayback, feedbackAudioMode, feedbackPlayerOptions, type FeedbackPlayer } from '@/lib/feedbackPlayback';

let preparation: Promise<void> | null = null;
// AudioPlayer.volume is an imperative native setter, not mutable React state.
function configurePlayerVolumes(...players: AudioPlayer[]) {
  for (const player of players) player.volume = soundEffectsConfig.volume;
}
function prepareFeedbackAudio(): Promise<void> {
  preparation ??= setAudioModeAsync(feedbackAudioMode)
    .catch((error: unknown) => { preparation = null; throw error; });
  return preparation;
}

export function useLessonSounds(enabledOverride?: boolean) {
  const {soundEnabled}=usePreferences();
  const enabled=enabledOverride ?? soundEnabled;
  const correct = useAudioPlayer(soundEffectsConfig.sources.correct, feedbackPlayerOptions);
  const wrong = useAudioPlayer(soundEffectsConfig.sources.wrong, feedbackPlayerOptions);
  const adapters = useMemo(()=>{
    function adapter(player:AudioPlayer,source:number) {
      let loadError:string|null=null;
      const feedback:FeedbackPlayer={
        get currentStatus(){return {...player.currentStatus,error:loadError};},
        pause:()=>player.pause(),seekTo:seconds=>player.seekTo(seconds),play:()=>player.play(),
        addListener:(_,listener)=>player.addListener('playbackStatusUpdate',status=>listener(status)),
        reload:()=>{loadError=null;player.replace(source);player.volume=soundEffectsConfig.volume;},
      };
      return {feedback,subscribe:()=>player.addListener('playbackStatusUpdate',status=>{
        if(status.error) loadError=status.error;
        else if(status.isLoaded) loadError=null;
      })};
    }
    return {correct:adapter(correct,soundEffectsConfig.sources.correct),wrong:adapter(wrong,soundEffectsConfig.sources.wrong)};
  },[correct,wrong]);
  const playback = useMemo(() => createFeedbackPlayback({ correct:adapters.correct.feedback, wrong:adapters.wrong.feedback }, prepareFeedbackAudio, {
    onError: (sound, error) => { if (__DEV__) console.warn(`[arca.audio.${sound}] Falha ao reproduzir efeito:`, error); },
  }), [adapters]);
  useEffect(()=>{
    const subscriptions=[adapters.correct.subscribe(),adapters.wrong.subscribe()];
    return ()=>subscriptions.forEach(subscription=>subscription.remove());
  },[adapters]);
  useEffect(() => {
    configurePlayerVolumes(correct, wrong);
    void prepareFeedbackAudio().catch(() => undefined);
  }, [correct, wrong]);
  useEffect(() => { playback.setEnabled(enabled); }, [enabled, playback]);
  useFocusEffect(useCallback(() => {
    playback.setActive(AppState.currentState === null || AppState.currentState === 'active');
    const subscription = AppState.addEventListener('change', state => playback.setActive(state === 'active'));
    return () => { subscription.remove(); playback.setActive(false); };
  }, [playback]));
  useEffect(() => {
    if (!__DEV__ || !soundEffectsConfig.diagnostics) return;
    const subscriptions = Object.entries({ correct, wrong }).map(([name, player]) => {
      let previous = '';
      return player.addListener('playbackStatusUpdate', status => {
        const summary = JSON.stringify({ loaded: status.isLoaded, playing: status.playing, finished: status.didJustFinish, duration: status.duration });
        if (summary !== previous) { previous = summary; console.debug(`[arca.audio.${name}] ${summary}`); }
      });
    });
    return () => subscriptions.forEach(subscription => subscription.remove());
  }, [correct, wrong]);
  return playback.play;
}
