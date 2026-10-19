begin;

create table public.membership_config (
  singleton boolean primary key default true check(singleton),
  billing_enabled boolean not null default false,
  product_id text not null default 'arca_vip',
  monthly_plan text not null default 'mensal',
  yearly_plan text not null default 'anual',
  xp_percent integer not null default 10 check(xp_percent between 0 and 100),
  referral_days integer not null default 3 check(referral_days between 1 and 30),
  verification_hours integer not null default 24 check(verification_hours between 1 and 48)
);
insert into public.membership_config(singleton) values(true);

-- Tokens never leave the service-role backend. Deleted owners cannot transfer a receipt.
create table public.play_subscriptions (
  token_hash text primary key check(token_hash ~ '^[a-f0-9]{64}$'),
  purchase_token text not null,
  user_id uuid references public.profiles(id) on delete set null,
  account_hash text not null check(account_hash ~ '^[a-f0-9]{64}$'),
  product_id text not null,
  base_plan text not null,
  state text not null,
  expires_at timestamptz not null,
  verified_at timestamptz not null,
  auto_renew boolean not null default false
);
create index play_subscriptions_owner on public.play_subscriptions(user_id);
create index play_subscriptions_check on public.play_subscriptions(verified_at);
create table public.play_verification_limits (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  window_at timestamptz not null default now(),
  attempts integer not null default 1
);
create table public.referral_codes (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  code text not null unique default upper(substr(replace(gen_random_uuid()::text,'-',''),1,16))
);
create table public.membership_devices (
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_hash text not null check(device_hash ~ '^[a-f0-9]{64}$'),
  primary key(user_id,device_hash)
);
create index membership_devices_hash on public.membership_devices(device_hash);
create table public.learning_referrals (
  invitee uuid primary key references public.profiles(id) on delete cascade,
  inviter uuid references public.profiles(id) on delete set null,
  device_hash text check(device_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  rewarded_at timestamptz,
  blocked boolean not null default false,
  check(inviter is distinct from invitee)
);
-- A phone used for an awarded referral cannot mint another reward by recreating accounts.
create table public.referral_device_rewards (
  device_hash text primary key,
  created_at timestamptz not null default now()
);
create table public.referral_benefits (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  unlimited_until timestamptz not null
);
alter table public.membership_config enable row level security;
alter table public.play_subscriptions enable row level security;
alter table public.play_verification_limits enable row level security;
alter table public.referral_codes enable row level security;
alter table public.membership_devices enable row level security;
alter table public.learning_referrals enable row level security;
alter table public.referral_device_rewards enable row level security;
alter table public.referral_benefits enable row level security;
revoke all on public.membership_config,public.play_subscriptions,public.play_verification_limits,public.referral_codes,public.membership_devices,
  public.learning_referrals,public.referral_device_rewards,public.referral_benefits from public,anon,authenticated;

create function public.membership_vip_until(p_user uuid) returns timestamptz
language sql stable security definer set search_path='' as $$
  select max(least(s.expires_at,s.verified_at+c.verification_hours*interval '1 hour'))
  from public.play_subscriptions s cross join public.membership_config c
  where c.singleton and s.user_id=p_user and s.state in ('SUBSCRIPTION_STATE_ACTIVE','SUBSCRIPTION_STATE_IN_GRACE_PERIOD','SUBSCRIPTION_STATE_CANCELED')
    and s.expires_at>now() and s.verified_at+c.verification_hours*interval '1 hour'>now()
$$;
create function public.membership_unlimited(p_user uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select coalesce(public.membership_vip_until(p_user)>now(),false)
    or exists(select 1 from public.referral_benefits where user_id=p_user and unlimited_until>now())
$$;

create function public.membership_signup_referral() returns trigger
language plpgsql security definer set search_path='' as $$
declare meta jsonb; sender uuid; device text; invite text;
begin
  select raw_user_meta_data into meta from auth.users where id=new.id;
  device:=meta->>'referral_device'; invite:=upper(btrim(meta->>'referral_code'));
  if device is not null and device ~ '^[a-f0-9]{64}$' then
    insert into public.membership_devices values(new.id,device) on conflict do nothing;
  else device:=null; end if;
  if meta->>'referral_consent' is distinct from 'true' then return new; end if;
  select user_id into sender from public.referral_codes where code=invite;
  if sender is null or sender=new.id then return new; end if;
  insert into public.learning_referrals(invitee,inviter,device_hash,blocked)
    values(new.id,sender,device,exists(select 1 from public.membership_devices where user_id=sender and device_hash=device));
  -- Both parties consent: sender shared their code; recipient accepted during signup.
  if (select count(*) from public.learning_friendships where sender in (person_a,person_b) and status='accepted')<200 then
    insert into public.learning_friendships(person_a,person_b,requested_by,status)
      values(least(new.id,sender),greatest(new.id,sender),sender,'accepted') on conflict do nothing;
  end if;
  return new;
end;
$$;
create trigger profiles_signup_referral after insert on public.profiles
  for each row execute function public.membership_signup_referral();

create function public.learning_invite_preview(p_code text) returns text
language sql stable security definer set search_path='' as $$
  select p.display_name from public.referral_codes c join public.profiles p on p.id=c.user_id
    where char_length(p_code)=16 and c.code=upper(btrim(p_code))
$$;

create function public.membership_claim_referral(p_invitee uuid) returns void
language plpgsql security definer set search_path='' as $$
declare r public.learning_referrals; days integer; inserted text;
begin
  select * into r from public.learning_referrals where invitee=p_invitee for update;
  if not found or r.rewarded_at is not null or r.blocked or r.inviter is null or r.device_hash is null then return; end if;
  -- No imported progress or client completion flag counts: require a finished server session.
  if not exists(select 1 from public.lesson_attempts a join public.battery_wallets w on w.user_id=a.user_id
    join public.battery_sessions s on s.wallet_id=w.id and s.attempt_id=a.attempt_key and s.lesson_id=a.lesson_id
    where a.user_id=p_invitee and a.created_at>=r.created_at and s.completed and cardinality(s.queue)=0 and not s.legacy) then return; end if;
  if not exists(select 1 from public.membership_devices where user_id=r.inviter) then return; end if;
  if exists(select 1 from public.membership_devices a join public.membership_devices b using(device_hash)
    where a.user_id=p_invitee and b.user_id=r.inviter) then
    update public.learning_referrals set blocked=true where invitee=p_invitee; return;
  end if;
  insert into public.referral_device_rewards(device_hash) values(r.device_hash) on conflict do nothing returning device_hash into inserted;
  if inserted is null then update public.learning_referrals set blocked=true where invitee=p_invitee; return; end if;
  select referral_days into days from public.membership_config where singleton;
  insert into public.referral_benefits(user_id,unlimited_until) values(r.inviter,now()+days*interval '1 day')
    on conflict(user_id) do update set unlimited_until=greatest(now(),public.referral_benefits.unlimited_until)+days*interval '1 day';
  update public.learning_referrals set rewarded_at=now() where invitee=p_invitee;
end;
$$;

create function public.learning_membership(p_device text default null) returns jsonb
language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare owner uuid:=auth.uid(); vip timestamptz; promo timestamptz; code text; c public.membership_config; pending record;
begin
  if owner is null then raise exception 'auth_required'; end if;
  if p_device is not null then
    if p_device !~ '^[a-f0-9]{64}$' then raise exception 'device_invalid'; end if;
    insert into public.membership_devices values(owner,p_device) on conflict do nothing;
    update public.learning_referrals set device_hash=p_device where invitee=owner and device_hash is null;
  end if;
  insert into public.referral_codes(user_id) values(owner) on conflict do nothing;
  perform public.membership_claim_referral(owner);
  for pending in select invitee from public.learning_referrals where inviter=owner and rewarded_at is null and not blocked order by invitee loop
    perform public.membership_claim_referral(pending.invitee);
  end loop;
  select * into c from public.membership_config where singleton;
  select referral_codes.code into code from public.referral_codes where user_id=owner;
  vip:=public.membership_vip_until(owner);
  select unlimited_until into promo from public.referral_benefits where user_id=owner and unlimited_until>now();
  return jsonb_build_object('owner',owner,'serverNow',now(),'vip',vip is not null,'vipUntil',case when vip is null then null else
    (select max(expires_at) from public.play_subscriptions where user_id=owner and expires_at>now()
      and state in ('SUBSCRIPTION_STATE_ACTIVE','SUBSCRIPTION_STATE_IN_GRACE_PERIOD','SUBSCRIPTION_STATE_CANCELED')
      and verified_at+c.verification_hours*interval '1 hour'>now()) end,
    'unlimited',vip is not null or promo is not null,'referralUntil',promo,'code',code,'billingReady',c.billing_enabled,
    'rewardDays',c.referral_days,'xpPercent',c.xp_percent,
    'invites',jsonb_build_object('pending',(select count(*) from public.learning_referrals where inviter=owner and rewarded_at is null and not blocked),
      'rewarded',(select count(*) from public.learning_referrals where inviter=owner and rewarded_at is not null),
      'blocked',(select count(*) from public.learning_referrals where inviter=owner and blocked)));
end;
$$;

-- The client cannot call this. Only the Google-verifying Edge Function can store receipts.
create function public.play_verification_admit(p_user uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare count integer;
begin
  insert into public.play_verification_limits(user_id) values(p_user)
    on conflict(user_id) do update set
      window_at=case when public.play_verification_limits.window_at<=now()-interval '1 minute' then now() else public.play_verification_limits.window_at end,
      attempts=case when public.play_verification_limits.window_at<=now()-interval '1 minute' then 1 else least(1000,public.play_verification_limits.attempts+1) end
    returning attempts into count;
  return count<=12;
end;
$$;

create function public.store_play_subscription(p_user uuid,p_token text,p_account text,p_product text,p_plan text,
  p_state text,p_expiry timestamptz,p_checked timestamptz,p_renew boolean) returns void
language plpgsql security definer set search_path='' as $$
declare hashed text:=encode(sha256(convert_to(p_token,'UTF8')),'hex'); old public.play_subscriptions; c public.membership_config;
begin
  select * into c from public.membership_config where singleton;
  if p_product<>c.product_id or p_plan not in(c.monthly_plan,c.yearly_plan) or p_account<>encode(sha256(convert_to(p_user::text,'UTF8')),'hex')
    or char_length(p_token) not between 10 and 4096 or p_checked>now()+interval '1 minute' or p_checked<now()-interval '10 minutes' then raise exception 'purchase_invalid'; end if;
  perform pg_advisory_xact_lock(hashtextextended(hashed,0));
  select * into old from public.play_subscriptions where token_hash=hashed for update;
  if found and (old.user_id is distinct from p_user or old.account_hash<>p_account) then raise exception 'purchase_owner_mismatch'; end if;
  insert into public.play_subscriptions values(hashed,p_token,p_user,p_account,p_product,p_plan,p_state,p_expiry,p_checked,p_renew)
    on conflict(token_hash) do update set state=excluded.state,expires_at=excluded.expires_at,verified_at=excluded.verified_at,
      base_plan=excluded.base_plan,auto_renew=excluded.auto_renew where public.play_subscriptions.verified_at<=excluded.verified_at;
end;
$$;

-- Preserve the receipt guard. Unlimited energy changes the cost, never the grading rules.
do $$ declare definition text; needle text:='when enabled and not s.legacy and first_answer'; begin
  select pg_get_functiondef('public.learning_battery_before_chests(text,text,text,text,jsonb,integer,text,jsonb)'::regprocedure) into definition;
  if strpos(definition,needle)=0 then raise exception 'battery_upgrade_shape_changed'; end if;
  definition:=replace(definition,needle,'when enabled and not public.membership_unlimited(owner) and not s.legacy and first_answer');
  definition:=replace(definition,'if enabled and not s.legacy and','if enabled and not public.membership_unlimited(owner) and not s.legacy and');
  execute definition;
end $$;
alter function public.learning_battery(text,text,text,text,jsonb,integer,text,jsonb) rename to learning_battery_before_membership;
create function public.learning_battery(p_action text default 'status',p_lesson text default null,p_attempt text default null,
  p_question text default null,p_answer jsonb default null,p_turn integer default null,p_guest text default null,p_resume jsonb default null) returns jsonb
language plpgsql security definer set search_path='' as $$
  begin return public.learning_battery_before_membership(p_action,p_lesson,p_attempt,p_question,p_answer,p_turn,p_guest,p_resume)
    ||jsonb_build_object('unlimited',public.membership_unlimited(auth.uid())); end;
$$;

alter function public.complete_learning_lesson(text,jsonb,text) rename to complete_learning_lesson_before_membership;
create function public.complete_learning_lesson(p_lesson_id text,p_answers jsonb,p_attempt_id text) returns jsonb
language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare owner uuid:=auth.uid(); existing boolean; payload jsonb; bonus integer; base integer; target text;
begin
  if owner is null then raise exception 'auth_required'; end if;
  perform 1 from public.profiles where id=owner for update;
  select exists(select 1 from public.lesson_attempts where user_id=owner and attempt_key=p_attempt_id) into existing;
  payload:=public.complete_learning_lesson_before_membership(p_lesson_id,p_answers,p_attempt_id);
  base:=(payload->'result'->>'xpEarned')::integer;
  if not existing and base>0 and public.membership_vip_until(owner) is not null then
    select floor(base*xp_percent/100.0)::integer into bonus from public.membership_config where singleton;
    payload:=jsonb_set(payload,'{result,xpEarned}',to_jsonb(base+bonus));
    payload:=jsonb_set(payload,'{result,vipBonus}',to_jsonb(bonus));
    update public.lesson_attempts set result=payload->'result' where user_id=owner and attempt_key=p_attempt_id;
    update public.user_lesson_progress set xp_earned=xp_earned+bonus where user_id=owner and lesson_id=p_lesson_id;
    update public.profiles set xp_total=xp_total+bonus where id=owner;
    update public.xp_events set amount=amount+bonus where user_id=owner and lesson_id=p_lesson_id;
    update public.user_daily_activity set xp_earned=xp_earned+bonus where user_id=owner and activity_date=(now() at time zone 'UTC')::date;
    select unit_id into target from public.lessons where id=p_lesson_id;
    payload:=jsonb_set(payload,'{snapshot}',public.learning_snapshot(target));
  end if;
  perform public.membership_claim_referral(owner);
  return payload;
end;
$$;

create function public.enforce_vip_avatar() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.avatar_key like 'vip-%' and (tg_op='INSERT' or new.avatar_key is distinct from old.avatar_key)
    and public.membership_vip_until(new.id) is null then raise exception 'vip_required'; end if;
  return new;
end;
$$;
create trigger profiles_vip_avatar before insert or update of avatar_key on public.profiles for each row execute function public.enforce_vip_avatar();

-- Do not announce a finite refill while the account has unlimited battery.
do $$ declare definition text; begin
  select pg_get_functiondef('public.push_claim(integer)'::regprocedure) into definition;
  execute replace(definition,'if prefs.energy and public.energy_applies(prefs.user_id) then',
    'if prefs.energy and public.energy_applies(prefs.user_id) and not public.membership_unlimited(prefs.user_id) then');
  select pg_get_functiondef('public.push_job_current(uuid)'::regprocedure) into definition;
  execute replace(definition,'public.energy_applies(j.user_id)','public.energy_applies(j.user_id) and not public.membership_unlimited(j.user_id)');
end $$;

revoke all on function public.membership_vip_until(uuid),public.membership_unlimited(uuid),public.membership_signup_referral(),
  public.membership_claim_referral(uuid),public.enforce_vip_avatar(),public.learning_membership(text),
  public.learning_invite_preview(text),
  public.play_verification_admit(uuid),
  public.store_play_subscription(uuid,text,text,text,text,text,timestamptz,timestamptz,boolean),
  public.learning_battery_before_membership(text,text,text,text,jsonb,integer,text,jsonb),
  public.complete_learning_lesson_before_membership(text,jsonb,text),
  public.learning_battery(text,text,text,text,jsonb,integer,text,jsonb),public.complete_learning_lesson(text,jsonb,text) from public,anon,authenticated;
grant execute on function public.learning_membership(text),public.complete_learning_lesson(text,jsonb,text) to authenticated;
grant execute on function public.learning_invite_preview(text) to anon,authenticated;
grant execute on function public.learning_battery(text,text,text,text,jsonb,integer,text,jsonb) to anon,authenticated;
-- Supabase owns this role in production; PGlite tests deliberately do not.
do $$ begin if exists(select 1 from pg_roles where rolname='service_role') then
  grant select,update on public.membership_config to service_role;
  grant select on public.play_subscriptions to service_role;
  grant execute on function public.store_play_subscription(uuid,text,text,text,text,text,timestamptz,timestamptz,boolean) to service_role;
  grant execute on function public.play_verification_admit(uuid) to service_role;
end if; end $$;
notify pgrst,'reload schema';
commit;
