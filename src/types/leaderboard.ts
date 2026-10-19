import type { ProfileFrame } from '../lib/profileAppearance.ts';

export type LeaderboardEntry = {
  id: string;
  display_name: string;
  avatar_key: string;
  xp_total: number;
  position: number;
  /** Moldura visível (comum sem VIP ativo). */
  frame: ProfileFrame;
  /** Mostrar o selo VIP (VIP ativo e selo ligado). */
  vip: boolean;
};
export type RankingScope = 'total' | 'weekly' | 'friends';
export type Leaderboard = {
  top: LeaderboardEntry[];
  current: LeaderboardEntry | null;
  period?: { start: string; end: string };
};
