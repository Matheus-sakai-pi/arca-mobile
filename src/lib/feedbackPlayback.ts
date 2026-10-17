export type FeedbackSound = 'correct' | 'wrong';
export const feedbackAudioMode = {
  interruptionMode: 'mixWithOthers',
  // Android otherwise suppresses play() when the ringer is silent or vibrating.
  playsInSilentMode: true,
  shouldRouteThroughEarpiece: false,
  shouldPlayInBackground: false,
  allowsRecording: false,
  allowsBackgroundRecording: false,
} as const;
export const feedbackPlayerOptions = { downloadFirst:false, updateInterval:100 } as const;
type FeedbackStatus = {isLoaded?:boolean;error?:string|null};
export type FeedbackPlayer = {
  readonly currentStatus: { isLoaded: boolean; error?: string | null };
  pause: () => void;
  seekTo: (seconds: number) => Promise<void>;
  play: () => void | Promise<void>;
  addListener?: (event: 'playbackStatusUpdate', listener: (status?:FeedbackStatus) => void) => { remove: () => void };
  reload?: () => void;
};
type PlaybackOptions = { loadTimeoutMs?: number; onError?: (sound: FeedbackSound, error: unknown) => void };

export function createFeedbackPlayback(players: Record<FeedbackSound, FeedbackPlayer>, prepare: () => Promise<void>, { loadTimeoutMs = 2000, onError }: PlaybackOptions = {}) {
  let enabled = true;
  let active = false;
  let revision = 0;
  const pendingLoads = new Set<() => void>();
  function cancelLoads() { for (const cancelLoad of pendingLoads) cancelLoad(); }
  function pause(player: FeedbackPlayer) {
    try { player.pause(); } catch { /* A released, inactive player must not silence the selected one. */ }
  }
  function waitUntilLoaded(player: FeedbackPlayer, current: () => boolean): Promise<boolean> {
    if (!current()) return Promise.resolve(false);
    if (player.currentStatus.error) return Promise.reject(new Error(player.currentStatus.error));
    if (player.currentStatus.isLoaded) return Promise.resolve(true);
    // Native preparation is asynchronous; keep this request until ready.
    return new Promise((resolve, reject) => {
      let settled = false;
      let subscription: { remove: () => void } | undefined;
      let poll: ReturnType<typeof setInterval> | undefined;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      function finish(ready: boolean, error?: unknown) {
        if (settled) return;
        settled = true;
        clearInterval(poll);
        clearTimeout(timeout);
        try { subscription?.remove(); } catch { /* Cleanup may follow native disposal. */ }
        pendingLoads.delete(cancelLoad);
        if (error) reject(error); else resolve(ready);
      }
      function cancelLoad() { finish(false); }
      function check(event?:FeedbackStatus) {
        if (!current()) { finish(false); return; }
        try {
          // Android currentStatus.error is always null; decoder errors exist only in events.
          const status = event ?? player.currentStatus;
          if (status.error) finish(false, new Error(status.error));
          else if (status.isLoaded) finish(true);
        } catch (error) { finish(false, error); }
      }
      pendingLoads.add(cancelLoad);
      try {
        subscription = player.addListener?.('playbackStatusUpdate', check);
        if (settled) { subscription?.remove(); return; }
        poll = setInterval(()=>check(), 50);
        timeout = setTimeout(() => finish(false, new Error('O efeito sonoro não ficou pronto a tempo.')), loadTimeoutMs);
        check();
      } catch (error) { finish(false, error); }
    });
  }
  function cancel() {
    revision++;
    cancelLoads();
    for (const player of Object.values(players)) pause(player);
  }
  return {
    setEnabled(value: boolean) { enabled = value; if (!value) cancel(); },
    setActive(value: boolean) { active = value; if (!value) cancel(); },
    async play(sound: FeedbackSound) {
      if (!enabled || !active) return;
      const request = ++revision;
      cancelLoads();
      const current = () => enabled && active && request === revision;
      try {
        await prepare();
        const player = players[sound];
        // Android's isLoaded getter excludes STATE_ENDED; currentStatus includes it.
        for (let attempt=0;attempt<2;attempt++) {
          try {
            if (!await waitUntilLoaded(player,current) || !current()) return;
            pause(players[sound === 'correct' ? 'wrong' : 'correct']);
            pause(player);
            await player.seekTo(0);
            if (current()) await player.play();
            return;
          } catch(error) {
            if (!current() || attempt > 0 || !player.reload) throw error;
            // Recover a failed native source once, never reload on healthy answers.
            player.reload();
          }
        }
      } catch (error) {
        if (current()) onError?.(sound, error);
        // Audio is optional feedback: storage, scoring and navigation must remain usable.
      }
    },
  };
}
