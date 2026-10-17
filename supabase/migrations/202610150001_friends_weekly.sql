begin;

create table public.learning_friendships (
  person_a uuid not null references public.profiles(id) on delete cascade,
  person_b uuid not null references public.profiles(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  primary key (person_a,person_b),
  check (person_a < person_b),
  check (requested_by in (person_a,person_b))
);
create index learning_friendships_b on public.learning_friendships(person_b,status);
create index learning_friendships_sender on public.learning_friendships(requested_by) where status='pending';
create index xp_events_weekly on public.xp_events(created_at,user_id) where reason='lesson_completed';
create index profiles_username_search on public.profiles(lower(username) text_pattern_ops);
alter table public.learning_friendships enable row level security;
revoke all on public.learning_friendships from public,anon,authenticated;
grant select on public.learning_friendships to authenticated;
create policy "Only friendship participants" on public.learning_friendships for select to authenticated
  using ((select auth.uid()) in (person_a,person_b));

create function public.learning_friends() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare owner uuid := auth.uid(); result jsonb;
begin
  if owner is null then raise exception 'auth_required'; end if;
  with people as (
    select p.id,p.username,p.display_name,p.avatar_key,
      case when f.status='accepted' then 'friend' when f.requested_by=owner then 'outgoing' else 'incoming' end as relationship
    from public.learning_friendships f join public.profiles p
      on p.id=case when f.person_a=owner then f.person_b else f.person_a end
    where owner in (f.person_a,f.person_b)
  ) select jsonb_build_object(
    'friends',coalesce(jsonb_agg(to_jsonb(p) order by p.display_name,p.id) filter(where relationship='friend'),'[]'::jsonb),
    'incoming',coalesce(jsonb_agg(to_jsonb(p) order by p.display_name,p.id) filter(where relationship='incoming'),'[]'::jsonb),
    'outgoing',coalesce(jsonb_agg(to_jsonb(p) order by p.display_name,p.id) filter(where relationship='outgoing'),'[]'::jsonb)
  ) into result from people p;
  return result;
end;
$$;

create function public.search_learning_people(p_query text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare owner uuid := auth.uid(); query text := lower(ltrim(btrim(p_query),'@')); result jsonb;
begin
  if owner is null then raise exception 'auth_required'; end if;
  if query is null or query !~ '^[a-z0-9_]{3,60}$' then raise exception 'friend_query_invalid'; end if;
  select coalesce(jsonb_agg(to_jsonb(p) order by p.exact_match desc,p.username,p.id),'[]'::jsonb) into result from (
    select p.id,p.username,p.display_name,p.avatar_key,
      case when f.status='accepted' then 'friend' when f.requested_by=owner then 'outgoing'
        when f.requested_by is not null then 'incoming' else 'none' end as relationship,
      lower(p.username)=query as exact_match
    from public.profiles p left join public.learning_friendships f
      on f.person_a=least(owner,p.id) and f.person_b=greatest(owner,p.id)
    where p.id<>owner and lower(p.username) like replace(query,'_','\_')||'%' escape '\'
    order by (lower(p.username)=query) desc,p.username,p.id limit 20
  ) p;
  -- Only the explicit public identity projection leaves the RPC.
  return (select coalesce(jsonb_agg(item-'exact_match'),'[]'::jsonb) from jsonb_array_elements(result) item);
end;
$$;

create function public.learning_friend_action(p_person uuid,p_action text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare owner uuid := auth.uid(); a uuid := least(owner,p_person); b uuid := greatest(owner,p_person);
  existing public.learning_friendships; n integer;
begin
  if owner is null then raise exception 'auth_required'; end if;
  if p_person is null or owner=p_person then raise exception 'friend_person_invalid'; end if;
  if p_action is null or p_action not in ('request','accept','decline','cancel','remove') then raise exception 'friend_action_invalid'; end if;
  -- Ordered profile locks serialize reverse requests and per-person limits, too.
  perform id from public.profiles where id in (owner,p_person) order by id for update;
  if not exists(select 1 from public.profiles where id=p_person) then raise exception 'friend_person_missing'; end if;
  select * into existing from public.learning_friendships where person_a=a and person_b=b;
  if p_action='request' then
    if existing.status='accepted' or (existing.status='pending' and existing.requested_by=owner) then return public.learning_friends(); end if;
    if existing.status='pending' then raise exception 'friend_accept_required'; end if;
    select count(*) into n from public.learning_friendships where requested_by=owner and status='pending';
    if n>=50 then raise exception 'friend_limit'; end if;
    select count(*) into n from public.learning_friendships where p_person in (person_a,person_b) and status='pending';
    if n>=100 then raise exception 'friend_limit'; end if;
    insert into public.learning_friendships(person_a,person_b,requested_by,status) values(a,b,owner,'pending');
  elsif p_action='accept' then
    if existing.status='accepted' then return public.learning_friends(); end if;
    if existing.status is distinct from 'pending' or existing.requested_by=owner then raise exception 'friend_not_recipient'; end if;
    if exists(select member from (values(owner),(p_person)) members(member)
      where (select count(*) from public.learning_friendships where member in (person_a,person_b) and status='accepted')>=200)
      then raise exception 'friend_limit'; end if;
    update public.learning_friendships set status='accepted' where person_a=a and person_b=b;
  elsif p_action in ('decline','cancel') then
    if existing.status is null then return public.learning_friends(); end if;
    if existing.status<>'pending' or (p_action='cancel' and existing.requested_by<>owner)
      or (p_action='decline' and existing.requested_by=owner) then raise exception 'friend_not_allowed'; end if;
    delete from public.learning_friendships where person_a=a and person_b=b;
  else
    if existing.status is null then return public.learning_friends(); end if;
    if existing.status<>'accepted' then raise exception 'friend_not_allowed'; end if;
    delete from public.learning_friendships where person_a=a and person_b=b;
  end if;
  return public.learning_friends();
end;
$$;

create function public.learning_leaderboard_scope(p_scope text) returns jsonb
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
    'top',coalesce((select jsonb_agg(to_jsonb(t) order by t.position) from (select * from ranked order by position limit 10) t),'[]'::jsonb),
    'current',(select to_jsonb(r) from ranked r where id=owner)
  ) into result;
  if p_scope='weekly' then result := result||jsonb_build_object('period',jsonb_build_object('start',week_start,'end',week_end)); end if;
  return result;
end;
$$;

revoke all on function public.learning_friends(),public.search_learning_people(text),public.learning_friend_action(uuid,text),public.learning_leaderboard_scope(text) from public,anon,authenticated;
grant execute on function public.learning_friends(),public.search_learning_people(text),public.learning_friend_action(uuid,text) to authenticated;
grant execute on function public.learning_leaderboard_scope(text) to anon,authenticated;
comment on function public.learning_leaderboard_scope(text) is 'Weekly: Monday 00:00 America/Sao_Paulo, confirmed lesson XP only (no guest import); friends: accepted relationships plus caller, total XP. Existing total RPC unchanged.';
notify pgrst,'reload schema';
commit;
