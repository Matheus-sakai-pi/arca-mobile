begin;

create table public.push_config (
  singleton boolean primary key default true check(singleton),
  enabled boolean not null default false,
  all_accounts boolean not null default false,
  test_user_id uuid references auth.users(id) on delete set null
);
insert into public.push_config(singleton) values(true);
create table public.push_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  energy boolean not null default false,
  comeback boolean not null default false,
  timezone text not null default 'America/Sao_Paulo',
  last_open_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  last_comeback_at timestamptz
);
create table public.push_devices (
  token text primary key check(token ~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{10,200}\]$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now()
);
create index push_devices_owner on public.push_devices(user_id);
create table public.push_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null references public.push_devices(token) on delete cascade,
  kind text not null check(kind in ('energy','comeback')),
  event_key text not null,
  created_at timestamptz not null default now(),
  status text not null default 'claimed' check(status in ('claimed','ticket','accepted','failed','unknown')),
  ticket text,
  receipt_checked_at timestamptz,
  unique(user_id,kind,event_key)
);
create index push_preferences_due on public.push_preferences(last_attempt_at,last_open_at) where energy or comeback;
create index push_receipts_due on public.push_deliveries(created_at) where status='ticket';
alter table public.push_config enable row level security;
alter table public.push_preferences enable row level security;
alter table public.push_devices enable row level security;
alter table public.push_deliveries enable row level security;
revoke all on public.push_config,public.push_preferences,public.push_devices,public.push_deliveries from public,anon,authenticated;

create function public.learning_push_preferences(p_energy boolean default null,p_comeback boolean default null,p_timezone text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare owner uuid:=auth.uid(); prefs public.push_preferences;
begin
  if owner is null then raise exception 'auth_required'; end if;
  if p_timezone is not null and not exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then raise exception 'timezone_invalid'; end if;
  if p_energy is null and p_comeback is null and p_timezone is null then
    select * into prefs from public.push_preferences where user_id=owner;
    return jsonb_build_object('energy',coalesce(prefs.energy,false),'comeback',coalesce(prefs.comeback,false),'timezone',coalesce(prefs.timezone,'America/Sao_Paulo'));
  end if;
  insert into public.push_preferences(user_id) values(owner) on conflict do nothing;
  update public.push_preferences set energy=coalesce(p_energy,energy),comeback=coalesce(p_comeback,comeback),timezone=coalesce(p_timezone,timezone)
    where user_id=owner returning * into prefs;
  if not prefs.energy and not prefs.comeback then delete from public.push_devices where user_id=owner; end if;
  return jsonb_build_object('energy',prefs.energy,'comeback',prefs.comeback,'timezone',prefs.timezone);
end;
$$;
create function public.learning_push_touch() returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'auth_required'; end if;
  update public.push_preferences set last_open_at=now() where user_id=auth.uid() and (energy or comeback);
end;
$$;
create function public.learning_push_register(p_token text,p_timezone text default null,p_previous text default null) returns void
language plpgsql security definer set search_path='' as $$
declare owner uuid:=auth.uid(); prefs public.push_preferences;
begin
  if owner is null then raise exception 'auth_required'; end if;
  select * into prefs from public.push_preferences where user_id=owner for update;
  if not found or not (prefs.energy or prefs.comeback) then raise exception 'push_consent_required'; end if;
  if p_token is null or p_token !~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{10,200}\]$' then raise exception 'push_token_invalid'; end if;
  if p_timezone is not null and not exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then raise exception 'timezone_invalid'; end if;
  delete from public.push_devices where user_id=owner and token=p_previous and token<>p_token;
  insert into public.push_devices(token,user_id) values(p_token,owner)
    on conflict(token) do update set user_id=owner,updated_at=now();
  update public.push_preferences set last_open_at=now(),timezone=coalesce(p_timezone,timezone) where user_id=owner;
  -- Retain at most five current installations per account.
  delete from public.push_devices where user_id=owner and token in (
    select token from public.push_devices where user_id=owner order by updated_at desc,token offset 5
  );
end;
$$;
create function public.learning_push_unregister(p_token text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'auth_required'; end if;
  delete from public.push_devices where token=p_token and user_id=auth.uid();
end;
$$;

-- Only the server dispatcher may claim work. Claims are never automatically resent:
-- an unknown HTTP outcome must not create repeated notifications.
create function public.push_claim(p_limit integer default 25) returns jsonb
language plpgsql security definer set search_path='' as $$
declare prefs public.push_preferences; wallet public.learning_energy_wallets; target text;
  due timestamptz; event text; category text; job uuid; result jsonb:='[]'::jsonb; count integer:=0; local_hour integer;
begin
  if not pg_catalog.pg_try_advisory_xact_lock(77892005) then return result; end if;
  delete from public.push_deliveries where created_at<now()-interval '30 days';
  update public.push_deliveries set status='unknown' where status in ('claimed','ticket') and created_at<now()-interval '24 hours';
  delete from public.push_devices where updated_at<now()-interval '30 days';
  if not (select enabled from public.push_config where singleton) then return result; end if;
  for prefs in select * from public.push_preferences where (energy or comeback)
    and ((select all_accounts from public.push_config where singleton) or user_id=(select test_user_id from public.push_config where singleton))
    and last_open_at<now()-interval '15 minutes' and (last_attempt_at is null or last_attempt_at<=now()-interval '24 hours')
    order by last_attempt_at nulls first,user_id for update skip locked
  loop
    exit when count>=greatest(1,least(100,coalesce(p_limit,25)));
    local_hour:=extract(hour from now() at time zone prefs.timezone)::integer;
    if local_hour<8 or local_hour>=20 then continue; end if;
    select token into target from public.push_devices where user_id=prefs.user_id order by updated_at desc,token limit 1;
    if target is null then continue; end if;
    event:=null; category:=null;
    if prefs.energy and public.energy_applies(prefs.user_id) then
      select * into wallet from public.learning_energy_wallets where user_id=prefs.user_id;
      if found and wallet.balance<5 and wallet.refill_at is not null then
        due:=case when wallet.balance=0 then wallet.refill_at else wallet.refill_at+(4-wallet.balance)*interval '4 hours' end;
        if due<=now() and due>=now()-interval '24 hours' then event:=due::text; category:='energy'; end if;
      end if;
    end if;
    if category is null and prefs.comeback and prefs.last_open_at<=now()-interval '3 days'
      and (prefs.last_comeback_at is null or prefs.last_comeback_at<=now()-interval '7 days') then
      category:='comeback'; event:=date_trunc('week',now() at time zone prefs.timezone)::date::text;
    end if;
    if category is null then continue; end if;
    job:=null;
    insert into public.push_deliveries(user_id,token,kind,event_key) values(prefs.user_id,target,category,event)
      on conflict(user_id,kind,event_key) do nothing returning id into job;
    if job is null then continue; end if;
    update public.push_preferences set last_attempt_at=now(),last_comeback_at=case when category='comeback' then now() else last_comeback_at end where user_id=prefs.user_id;
    result:=result||jsonb_build_array(jsonb_build_object('id',job,'user',prefs.user_id,'token',target,'kind',category)); count:=count+1;
  end loop;
  return result;
end;
$$;

create function public.push_receipts() returns jsonb
language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',j.id,'ticket',j.ticket)),'[]'::jsonb) from (
    select id,ticket from public.push_deliveries where status='ticket' and created_at<now()-interval '15 minutes'
    and (receipt_checked_at is null or receipt_checked_at<now()-interval '15 minutes') order by created_at limit 100
  ) j
$$;
create function public.push_job_current(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.push_deliveries j join public.push_devices d on d.token=j.token and d.user_id=j.user_id
    join public.push_preferences p on p.user_id=j.user_id where j.id=p_id and j.status='claimed'
    and (select enabled from public.push_config where singleton) and d.updated_at>now()-interval '30 days'
    and ((select all_accounts from public.push_config where singleton) or j.user_id=(select test_user_id from public.push_config where singleton))
    and p.last_open_at<now()-interval '15 minutes' and extract(hour from now() at time zone p.timezone) between 8 and 19
    and ((j.kind='energy' and p.energy and public.energy_applies(j.user_id)) or (j.kind='comeback' and p.comeback)))
$$;
create function public.push_finish(p_id uuid,p_status text,p_ticket text default null,p_invalid boolean default false) returns void
language plpgsql security definer set search_path='' as $$
declare endpoint text;
begin
  if p_status not in ('ticket','accepted','failed','unknown') then raise exception 'push_status_invalid'; end if;
  select token into endpoint from public.push_deliveries where id=p_id for update;
  if not found then return; end if;
  if p_invalid then delete from public.push_devices where token=endpoint; return; end if;
  update public.push_deliveries set status=p_status,ticket=coalesce(p_ticket,ticket),receipt_checked_at=now()
    where id=p_id and status in ('claimed','ticket');
end;
$$;

revoke all on function public.learning_push_preferences(boolean,boolean,text),public.learning_push_touch(),public.learning_push_register(text,text,text),public.learning_push_unregister(text),public.push_claim(integer),public.push_receipts(),public.push_job_current(uuid),public.push_finish(uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.learning_push_preferences(boolean,boolean,text),public.learning_push_touch(),public.learning_push_register(text,text,text),public.learning_push_unregister(text) to authenticated;
do $$begin
  if exists(select 1 from pg_roles where rolname='service_role') then
    grant execute on function public.push_claim(integer),public.push_receipts(),public.push_job_current(uuid),public.push_finish(uuid,text,text,boolean) to service_role;
  end if;
end$$;

commit;
