import type { FeedbackPlayer } from './feedbackPlayback.ts';

type Media = Pick<HTMLAudioElement, 'readyState' | 'error' | 'currentTime' | 'src' | 'preload' | 'volume' | 'play' | 'pause' | 'load' | 'addEventListener' | 'removeEventListener' | 'removeAttribute'>;
export function createWebFeedbackPlayer(media: Media | null, uri: string, volume: number): FeedbackPlayer & { dispose: () => void } {
  return {
    get currentStatus() { return { isLoaded: !!media && media.readyState >= 2, error: media?.error ? 'O navegador não conseguiu carregar o áudio.' : null }; },
    pause: () => media?.pause(),
    seekTo: async seconds => { if (media) media.currentTime = seconds; },
    // Keep the browser promise so cancellation/autoplay rejection is handled by playback.
    play: async () => { if (media) await media.play(); },
    addListener: (_event, listener) => {
      const changed = () => listener({ isLoaded: !!media && media.readyState >= 2, error: media?.error ? 'O navegador não conseguiu carregar o áudio.' : null });
      for (const event of ['loadeddata', 'canplay', 'error']) media?.addEventListener(event, changed);
      return { remove: () => { for (const event of ['loadeddata', 'canplay', 'error']) media?.removeEventListener(event, changed); } };
    },
    reload: () => { if (media) { media.src = uri; media.preload = 'auto'; media.volume = volume; media.load(); } },
    dispose: () => { if (media) { media.pause(); media.removeAttribute('src'); media.load(); } },
  };
}
