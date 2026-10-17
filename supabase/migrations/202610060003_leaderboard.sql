-- Profiles remain private. This RPC returns only the public leaderboard projection.
create index if not exists profiles_leaderboard_order on public.profiles (xp_total desc, id asc);

alter table public.profiles alter column avatar_key set default 'avatar-01';

create or replace function public.learning_leaderboard()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with leaders as (
    select id, display_name, avatar_key, xp_total
    from public.profiles order by xp_total desc, id asc limit 10
  ), top_rows as (
    select id, display_name, avatar_key, xp_total,
      row_number() over (order by xp_total desc, id asc) as position
    from leaders
  ), own_row as (
    select p.id, p.display_name, p.avatar_key, p.xp_total,
      1 + (select count(*) from public.profiles other
        where other.xp_total > p.xp_total or (other.xp_total = p.xp_total and other.id < p.id)) as position
    from public.profiles p where p.id = (select auth.uid())
  )
  select jsonb_build_object(
    'top', coalesce((select jsonb_agg(to_jsonb(t) order by t.position) from top_rows t), '[]'::jsonb),
    'current', (select to_jsonb(o) from own_row o)
  );
$$;
revoke all on function public.learning_leaderboard() from public;
grant execute on function public.learning_leaderboard() to anon, authenticated;
comment on function public.learning_leaderboard() is
  'Public Top 10 and caller position; XP DESC then immutable UUID ASC. No email or auth metadata.';
