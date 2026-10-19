begin;

-- Moldura e selo VIP no ranking. Só aparecem com VIP ativo, como no perfil:
-- quem perde o VIP volta para a moldura comum e sem selo.
create or replace function public.leaderboard_style(p_user uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select case when coalesce(public.membership_vip_until(p_user)>now(),false)
    then jsonb_build_object('frame',coalesce(a.frame_key,'classic'),'vip',coalesce(a.show_badge,true))
    else jsonb_build_object('frame','classic','vip',false) end
  from (select 1) as one left join public.profile_appearance a on a.user_id=p_user
$$;
revoke all on function public.leaderboard_style(uuid) from public,anon,authenticated;

-- Mesmas consultas de antes; cada linha ganha "frame" e "vip".
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
    'top', coalesce((select jsonb_agg(to_jsonb(t) || public.leaderboard_style(t.id) order by t.position) from top_rows t), '[]'::jsonb),
    'current', (select to_jsonb(o) || public.leaderboard_style(o.id) from own_row o)
  );
$$;

create or replace function public.learning_leaderboard_scope(p_scope text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare owner uuid := auth.uid(); result jsonb;
  week_start timestamptz := date_trunc('week',now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
  week_end timestamptz := (date_trunc('week',now() at time zone 'America/Sao_Paulo')+interval '7 days') at time zone 'America/Sao_Paulo';
begin
  if p_scope is null or p_scope not in ('weekly','friends') then raise exception 'ranking_scope_invalid'; end if;
  if p_scope='friends' and owner is null then raise exception 'auth_required'; end if;
  with weekly as (
    select user_id,sum(amount)::bigint as xp from public.xp_events
    where p_scope='weekly' and reason='lesson_completed' and created_at>=week_start and created_at<week_end group by user_id
  ), eligible as (
    select p.id,p.display_name,p.avatar_key,
      case when p_scope='weekly' then coalesce(w.xp,0) else p.xp_total end as xp_total
    from public.profiles p left join weekly w on w.user_id=p.id
    where p_scope='weekly' or p.id=owner or exists(
      select 1 from public.learning_friendships f where f.status='accepted'
      and f.person_a=least(owner,p.id) and f.person_b=greatest(owner,p.id))
  ), ranked as (
    select *,row_number() over(order by xp_total desc,id) as position from eligible
  ) select jsonb_build_object(
    'top',coalesce((select jsonb_agg(to_jsonb(t) || public.leaderboard_style(t.id) order by t.position) from (select * from ranked order by position limit 10) t),'[]'::jsonb),
    'current',(select to_jsonb(r) || public.leaderboard_style(r.id) from ranked r where id=owner)
  ) into result;
  if p_scope='weekly' then result := result||jsonb_build_object('period',jsonb_build_object('start',week_start,'end',week_end)); end if;
  return result;
end;
$$;

commit;
