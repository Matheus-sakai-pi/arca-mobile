export type ArtworkKey = 'friends' | 'review' | 'history' | 'challenge' | 'energy' | 'waypoint' | 'streak';

export function journeyCheckpoint(completed: number, total: number) {
  if (!Number.isFinite(total) || !Number.isInteger(total) || total < 1 || !Number.isFinite(completed)) return null;
  const done = Math.max(0, Math.min(total, Math.floor(completed)));
  const halfway = Math.ceil(total / 2);
  return { done, total, target: done < halfway ? halfway : total, reached: done >= halfway, finished: done === total };
}
