begin;

create table public.learning_energy_config (
  singleton boolean primary key default true check(singleton),
  enabled boolean not null default false,
  rollout integer not null default 100 check(rollout between 1 and 100),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
insert into public.learning_energy_config(singleton) values(true);
create table public.learning_energy_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 5 check(balance between 0 and 5),
  refill_at timestamptz,
  guest_merged boolean not null default false
);
create table public.learning_energy_access (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id text not null references public.lessons(id) on delete cascade,
  cost integer not null check(cost in (0,1)),
  created_at timestamptz not null default now(),
  primary key(user_id,lesson_id)
);
create table public.learning_energy_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default current_date,
  blocked integer not null default 0,
  last_blocked_at timestamptz,
  primary key(user_id,day)
);
alter table public.learning_energy_config enable row level security;
alter table public.learning_energy_wallets enable row level security;
alter table public.learning_energy_access enable row level security;
alter table public.learning_energy_daily enable row level security;
revoke all on public.learning_energy_config,public.learning_energy_wallets,public.learning_energy_access,public.learning_energy_daily from public,anon,authenticated;

-- Existing server-side starts retain access when restrictions are eventually enabled.
insert into public.learning_energy_access(user_id,lesson_id,cost)
  select user_id,lesson_id,0 from public.user_lesson_progress where status='in_progress';

create function public.energy_applies(p_user uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select enabled and mod(('x'||substr(md5(p_user::text),1,7))::bit(28)::integer,100)<rollout
  from public.learning_energy_config where singleton
$$;
create function public.learning_energy_public() returns boolean
language sql stable security definer set search_path='' as $$
  select enabled and rollout=100 from public.learning_energy_config where singleton
$$;
create function public.energy_intro(p_lesson text) returns boolean
language sql stable security definer set search_path='' as $$
  select p_lesson in (
    select l.id from public.lessons l join public.units u on u.id=l.unit_id
    join public.courses c on c.id=u.course_id
    where c.id='biblia-basica' and c.published and u.published and l.published
    order by u.order_index,l.order_index,l.id limit 3
  )
$$;
create function public.energy_refresh(p_user uuid) returns void
language plpgsql security definer set search_path='' as $$
declare wallet public.learning_energy_wallets; ticks integer;
begin
  insert into public.learning_energy_wallets(user_id) values(p_user) on conflict do nothing;
  select * into wallet from public.learning_energy_wallets where user_id=p_user for update;
  if wallet.refill_at is not null and wallet.refill_at<=now() then
    ticks:=least(5,1+floor(extract(epoch from now()-wallet.refill_at)/14400)::integer);
    update public.learning_energy_wallets set balance=least(5,balance+ticks),
      refill_at=case when balance+ticks>=5 then null else refill_at+ticks*interval '4 hours' end
      where user_id=p_user;
  end if;
end;
$$;
create function public.learning_energy_status(p_lesson text default null,p_guest_source text default null,p_guest_balance integer default null,p_guest_wait integer default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare owner uuid:=auth.uid(); wallet public.learning_energy_wallets; free boolean; reserved boolean;
begin
  if owner is null then raise exception 'auth_required'; end if;
  perform 1 from public.profiles where id=owner for update;
  if not found then raise exception 'profile_missing'; end if;
  perform public.energy_refresh(owner);
  if p_guest_source is not null and exists(select 1 from public.guest_progress_imports where user_id=owner and source_id=p_guest_source) then
    if p_guest_balance is null or p_guest_balance not between 0 and 5 or p_guest_wait is null or p_guest_wait not between 0 and 14400 then raise exception 'energy_import_invalid'; end if;
    -- Untrusted guest input can only reduce the balance, never mint energy.
    update public.learning_energy_wallets set balance=least(balance,p_guest_balance),guest_merged=true,
      refill_at=case when least(balance,p_guest_balance)<5 then coalesce(refill_at,now()+greatest(1,p_guest_wait)*interval '1 second') else null end
      where user_id=owner and not guest_merged;
  end if;
  select * into wallet from public.learning_energy_wallets where user_id=owner;
  if p_lesson is not null then perform public.assert_lesson_available(owner,p_lesson); end if;
  reserved:=p_lesson is not null and exists(select 1 from public.learning_energy_access where user_id=owner and lesson_id=p_lesson);
  free:=p_lesson is null or public.energy_intro(p_lesson) or exists(select 1 from public.user_lesson_progress where user_id=owner and lesson_id=p_lesson and status in ('completed','mastered'));
  if p_lesson is not null and public.energy_applies(owner) and not free and not reserved and wallet.balance=0 then
    insert into public.learning_energy_daily(user_id,day,blocked,last_blocked_at) values(owner,(now() at time zone 'UTC')::date,1,now())
      on conflict(user_id,day) do update set blocked=least(100000,public.learning_energy_daily.blocked+1),last_blocked_at=now();
  end if;
  return jsonb_build_object('owner',owner,'available',true,'enabled',public.energy_applies(owner),'balance',wallet.balance,
    'nextRefillAt',wallet.refill_at,'serverNow',now(),'reserved',reserved,
    'cost',case when not public.energy_applies(owner) or free or reserved then 0 else 1 end,'allowed',true);
end;
$$;
create function public.learning_energy_begin(p_lesson text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare owner uuid:=auth.uid(); state jsonb; charge integer;
begin
  if owner is null then raise exception 'auth_required'; end if;
  state:=public.learning_energy_status(p_lesson);
  charge:=(state->>'cost')::integer;
  if charge=1 and (state->>'balance')::integer=0 then
    return state||jsonb_build_object('allowed',false);
  end if;
  if not (state->>'reserved')::boolean then
    insert into public.learning_energy_access(user_id,lesson_id,cost) values(owner,p_lesson,charge);
    if charge=1 then update public.learning_energy_wallets set balance=balance-1,
      refill_at=coalesce(refill_at,now()+interval '4 hours') where user_id=owner; end if;
  end if;
  insert into public.user_lesson_progress(user_id,lesson_id,status) values(owner,p_lesson,'in_progress')
    on conflict(user_id,lesson_id) do update set status=case when public.user_lesson_progress.status in ('completed','mastered') then public.user_lesson_progress.status else 'in_progress' end;
  return public.learning_energy_status(p_lesson)||jsonb_build_object('allowed',true,'charged',charge);
end;
$$;
create or replace function public.start_learning_lesson(p_lesson_id text) returns void
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  result:=public.learning_energy_begin(p_lesson_id);
  if not (result->>'allowed')::boolean then raise exception 'energy_exhausted'; end if;
end;
$$;
create function public.energy_check_completion() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.status not in ('completed','mastered') or not public.energy_applies(new.user_id) or public.energy_intro(new.lesson_id) then return new; end if;
  if tg_op='UPDATE' then if old.status in ('completed','mastered') then return new; end if; end if;
  -- Completion RPC uses INSERT .. ON CONFLICT, so the INSERT trigger must also check the stored row.
  if exists(select 1 from public.user_lesson_progress where user_id=new.user_id and lesson_id=new.lesson_id and status in ('completed','mastered')) then return new; end if;
  if not exists(select 1 from public.learning_energy_access where user_id=new.user_id and lesson_id=new.lesson_id) then raise exception 'energy_start_required'; end if;
  return new;
end;
$$;
create trigger energy_completion before insert or update on public.user_lesson_progress for each row execute function public.energy_check_completion();

create function public.arca_admin_energy() returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  if not public.arca_is_admin() then raise exception 'admin_required'; end if;
  select jsonb_build_object('enabled',c.enabled,'rollout',c.rollout,'updatedAt',c.updated_at,
    'wallets',(select count(*) from public.learning_energy_wallets),
    'paidStarts7',(select count(*) from public.learning_energy_access where cost=1 and created_at>=now()-interval '7 days'),
    'completedPaid7',(select count(*) from public.learning_energy_access a where a.cost=1 and a.created_at>=now()-interval '7 days' and exists(select 1 from public.user_lesson_progress p where p.user_id=a.user_id and p.lesson_id=a.lesson_id and p.status in ('completed','mastered'))),
    'blockedUsers7',(select count(distinct user_id) from public.learning_energy_daily where day>=(now() at time zone 'UTC')::date-6),
    'blocks7',(select coalesce(sum(blocked),0) from public.learning_energy_daily where day>=(now() at time zone 'UTC')::date-6),
    'returnedUsers7',(select count(distinct d.user_id) from public.learning_energy_daily d where d.day>=(now() at time zone 'UTC')::date-6 and exists(select 1 from public.lesson_attempts a where a.user_id=d.user_id and a.created_at>d.last_blocked_at))) into result
    from public.learning_energy_config c where singleton;
  return result;
end;
$$;
create function public.arca_admin_energy_update(p_enabled boolean,p_rollout integer,p_expected timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if not public.arca_is_admin() then raise exception 'admin_required'; end if;
  if p_enabled is null or p_rollout is null or p_rollout not between 1 and 100 then raise exception 'energy_config_invalid'; end if;
  perform 1 from public.learning_energy_config where singleton and updated_at=p_expected for update;
  if not found then raise exception 'energy_config_conflict'; end if;
  update public.learning_energy_config set enabled=p_enabled,rollout=p_rollout,updated_at=clock_timestamp(),updated_by=auth.uid() where singleton;
  return public.arca_admin_energy();
end;
$$;
revoke all on function public.energy_applies(uuid),public.energy_intro(text),public.energy_refresh(uuid),public.energy_check_completion(),public.learning_energy_status(text,text,integer,integer),public.learning_energy_begin(text),public.arca_admin_energy(),public.arca_admin_energy_update(boolean,integer,timestamptz) from public,anon,authenticated;
revoke all on function public.learning_energy_public() from public,anon,authenticated;
grant execute on function public.learning_energy_public() to anon,authenticated;
grant execute on function public.learning_energy_status(text,text,integer,integer),public.learning_energy_begin(text),public.arca_admin_energy(),public.arca_admin_energy_update(boolean,integer,timestamptz) to authenticated;

commit;
