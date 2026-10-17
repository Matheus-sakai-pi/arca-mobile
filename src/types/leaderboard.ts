export type LeaderboardEntry = {
  id: string;
  display_name: string;
  avatar_key: string;
  xp_total: number;
  position: number;
};
export type RankingScope = 'total' | 'weekly' | 'friends';
export type Leaderboard = {
  top: LeaderboardEntry[];
  current: LeaderboardEntry | null;
  period?: { start: string; end: string };
};
