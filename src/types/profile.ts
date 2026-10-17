export type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  xp_total: number;
  avatar_key: string;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
  created_at: string;
  updated_at: string;
};
