type Storage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  getAllKeys: () => Promise<readonly string[]>;
  multiRemove: (keys: string[]) => Promise<void>;
};
export function accountDataKey(key: string, userId: string): boolean {
  const cache = `arca.account.${userId}.v1`;
  return key === cache || key.startsWith(`${cache}.backup.`) || key === `arca.achievements.${userId}.v1`
    || key === `arca.study.${userId}.v1` || key === `arca.preferences.${userId}.v1` || key === `arca.preferences.${userId}.v1.pending` || key.startsWith(`arca.challenges.${userId}.`) || key === `arca.reminder-prompt.${userId}.v1` || key === `arca.energy.${userId}.v1` || key.startsWith(`arca.energy.${userId}.v1.backup.`);
}
export function createAccountStorage(storage: Storage) {
  const paused = new Set<string>();
  const writes = new Set<{ key: string; promise: Promise<void> }>();
  return {
    getItem: (key: string) => storage.getItem(key),
    async setItem(key: string, value: string) {
      if ([...paused].some(user => accountDataKey(key, user))) throw new Error('account_deletion_pending');
      const write = { key, promise: storage.setItem(key, value) }; writes.add(write);
      try { await write.promise; } finally { writes.delete(write); }
    },
    async pauseUser(userId: string) {
      paused.add(userId);
      // Drain writes already started; later responses cannot recreate an erased cache.
      await Promise.allSettled([...writes].filter(write => accountDataKey(write.key, userId)).map(write => write.promise));
    },
    resumeUser(userId: string) { paused.delete(userId); },
    async clearUser(userId: string) {
      await this.pauseUser(userId);
      const keys = (await storage.getAllKeys()).filter(key => accountDataKey(key, userId));
      if (keys.length) await storage.multiRemove(keys);
    },
  };
}
