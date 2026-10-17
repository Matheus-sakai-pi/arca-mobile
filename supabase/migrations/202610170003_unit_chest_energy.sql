begin;

-- CHEST_CONFIG_START
-- Generated from src/config/energy.ts. Do not edit these values here.
update public.battery_rules set rules=jsonb_set(rules,'{chest}','{"min":5,"max":7,"completedFraction":0.5}'::jsonb) where singleton;
-- CHEST_CONFIG_END

create table if not exists public.battery_unit_chests (
  wallet_id uuid not null references public.battery_wallets(id) on delete cascade,
  unit_id text not null references public.units(id) on delete cascade,
  rolled integer not null check(rolled>0),
  granted integer not null check(granted>=0 and granted<=rolled),
  claimed_at timestamptz not null default now(),
  primary key(wallet_id,unit_id)
);
alter table public.battery_unit_chests enable row level security;
revoke all on public.battery_unit_chests from public,anon,authenticated;

-- Preserve all existing exercise/energy behavior behind the same public RPC.
do $$ begin
  if to_regprocedure('public.learning_battery_before_chests(text,text,text,text,jsonb,integer,text,jsonb)') is null then
    alter function public.learning_battery(text,text,text,text,jsonb,integer,text,jsonb) rename to learning_battery_before_chests;
  end if;
end $$;
revoke all on function public.learning_battery_before_chests(text,text,text,text,jsonb,integer,text,jsonb) from public,anon,authenticated;

create or replace function public.learning_battery(p_action text default 'status',p_lesson text default null,p_attempt text default null,
  p_question text default null,p_answer jsonb default null,p_turn integer default null,p_guest text default null,p_resume jsonb default null) returns jsonb
language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare owner uuid:=auth.uid(); w public.battery_wallets; reward public.battery_unit_chests;
  r jsonb; chest_rules jsonb; result jsonb; total integer; done integer; target integer; rolled integer; granted integer;
begin
  if p_action not in ('chest_status','chest_claim') or p_action is null then
    return public.learning_battery_before_chests(p_action,p_lesson,p_attempt,p_question,p_answer,p_turn,p_guest,p_resume);
  end if;
  -- This acquires the usual profile/wallet locks and uses server UTC for refill.
  result:=public.learning_battery_before_chests(p_action=>'status',p_guest=>p_guest);
  if owner is not null then
    select * into w from public.battery_wallets where user_id=owner for update;
  else
    select * into w from public.battery_wallets where guest_hash=encode(sha256(convert_to(p_guest,'UTF8')),'hex') for update;
  end if;
  if not exists(select 1 from public.units u join public.courses c on c.id=u.course_id where u.id=p_lesson and u.published and c.published) then
    raise exception 'content_unavailable';
  end if;
  r:=public.battery_config(); chest_rules:=r->'chest';
  select count(*) into total from public.lessons where unit_id=p_lesson and published;
  if total=0 then raise exception 'content_unavailable'; end if;
  target:=ceil(total*(chest_rules->>'completedFraction')::numeric)::integer;
  if owner is not null then
    select count(*) into done from public.user_lesson_progress p join public.lessons l on l.id=p.lesson_id
      where p.user_id=owner and l.unit_id=p_lesson and l.published and p.status in ('completed','mastered');
  else
    -- Guests need actual server-confirmed completed attempts, never a client counter.
    select count(distinct s.lesson_id) into done from public.battery_sessions s join public.lessons l on l.id=s.lesson_id
      where s.wallet_id=w.id and l.unit_id=p_lesson and l.published and s.completed and cardinality(s.queue)=0;
  end if;
  select * into reward from public.battery_unit_chests where wallet_id=w.id and unit_id=p_lesson;
  if p_action='chest_claim' and reward.wallet_id is null then
    if done<target then raise exception 'chest_locked'; end if;
    if not (r->>'bonusOverflow')::boolean and w.balance>=(r->>'capacity')::integer then raise exception 'chest_battery_full'; end if;
    rolled:=(chest_rules->>'min')::integer+floor(random()*((chest_rules->>'max')::integer-(chest_rules->>'min')::integer+1))::integer;
    granted:=case when (r->>'bonusOverflow')::boolean then rolled else least(rolled,greatest(0,(r->>'capacity')::integer-w.balance)) end;
    insert into public.battery_unit_chests(wallet_id,unit_id,rolled,granted) values(w.id,p_lesson,rolled,granted) returning * into reward;
    update public.battery_wallets set balance=balance+granted,
      refill_at=case when balance+granted>=(r->>'capacity')::integer then null else refill_at end where id=w.id;
    result:=public.learning_battery_before_chests(p_action=>'status',p_guest=>p_guest);
  end if;
  return result||jsonb_build_object('chest',jsonb_build_object('unitId',p_lesson,'completed',done,'total',total,'target',target,
    'min',chest_rules->'min','max',chest_rules->'max','eligible',done>=target,'claimed',reward.wallet_id is not null,
    'reward',case when reward.wallet_id is null then null else jsonb_build_object('rolled',reward.rolled,'amount',reward.granted,'claimedAt',reward.claimed_at) end));
end;
$$;
revoke all on function public.learning_battery(text,text,text,text,jsonb,integer,text,jsonb) from public,anon,authenticated;
grant execute on function public.learning_battery(text,text,text,text,jsonb,integer,text,jsonb) to anon,authenticated;
notify pgrst,'reload schema';
commit;
