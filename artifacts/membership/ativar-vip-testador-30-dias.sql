begin;

-- Administrative gifts are not Google Play purchases. Keep their own audit trail.
create table if not exists public.admin_vip_grants (
  request_key text primary key check(char_length(request_key) between 1 and 200),
  user_id uuid references public.profiles(id) on delete set null,
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  reason text not null check(char_length(btrim(reason)) between 1 and 500),
  created_at timestamptz not null default now(),
  created_by text not null default current_user,
  revoked_at timestamptz,
  check(expires_at > starts_at)
);
create index if not exists admin_vip_grants_owner on public.admin_vip_grants(user_id);
alter table public.admin_vip_grants enable row level security;
revoke all on public.admin_vip_grants from public,anon,authenticated;

create or replace function public.membership_admin_vip_until(p_user uuid) returns timestamptz
language sql stable security definer set search_path='' as $$
  select max(expires_at) from public.admin_vip_grants
    where user_id=p_user and revoked_at is null and starts_at<=now() and expires_at>now()
$$;

create or replace function public.membership_vip_until(p_user uuid) returns timestamptz
language sql stable security definer set search_path='' as $$
  select greatest(public.membership_admin_vip_until(p_user),
    (select max(least(s.expires_at,s.verified_at+c.verification_hours*interval '1 hour'))
      from public.play_subscriptions s cross join public.membership_config c
      where c.singleton and s.user_id=p_user
        and s.state in ('SUBSCRIPTION_STATE_ACTIVE','SUBSCRIPTION_STATE_IN_GRACE_PERIOD','SUBSCRIPTION_STATE_CANCELED')
        and s.expires_at>now() and s.verified_at+c.verification_hours*interval '1 hour'>now()))
$$;

create or replace function public.learning_membership(p_device text default null) returns jsonb
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
    greatest(public.membership_admin_vip_until(owner),
      (select max(expires_at) from public.play_subscriptions where user_id=owner and expires_at>now()
        and state in ('SUBSCRIPTION_STATE_ACTIVE','SUBSCRIPTION_STATE_IN_GRACE_PERIOD','SUBSCRIPTION_STATE_CANCELED')
        and verified_at+c.verification_hours*interval '1 hour'>now())) end,
    'unlimited',vip is not null or promo is not null,'referralUntil',promo,'code',code,'billingReady',c.billing_enabled,
    'rewardDays',c.referral_days,'xpPercent',c.xp_percent,
    'invites',jsonb_build_object('pending',(select count(*) from public.learning_referrals where inviter=owner and rewarded_at is null and not blocked),
      'rewarded',(select count(*) from public.learning_referrals where inviter=owner and rewarded_at is not null),
      'blocked',(select count(*) from public.learning_referrals where inviter=owner and blocked)));
end;
$$;

revoke all on function public.membership_admin_vip_until(uuid),public.membership_vip_until(uuid),public.learning_membership(text)
  from public,anon,authenticated;
grant execute on function public.learning_membership(text) to authenticated;
notify pgrst,'reload schema';
commit;

-- Execute AFTER 202610180007_admin_vip.sql, as the database administrator.
-- This separate gift does not change the owner's grant or create a Play purchase.
begin;
set local timezone='UTC';
do $$
declare target uuid; matches integer; previous public.admin_vip_grants;
begin
  select count(*), (array_agg(u.id))[1] into matches,target
    from auth.users u join public.profiles p on p.id=u.id
    where lower(btrim(u.email))='matsakteste@gmail.com';
  if matches<>1 then raise exception 'Conta nao encontrada ou email ambiguo. Nenhum VIP foi concedido.'; end if;
  insert into public.admin_vip_grants(request_key,user_id,expires_at,reason)
    values('tester-matsakteste-2026-10-18-30-days',target,now()+interval '30 days','Teste VIP de 30 dias para a conta do testador, autorizado pelo titular')
    on conflict(request_key) do nothing;
  select * into previous from public.admin_vip_grants where request_key='tester-matsakteste-2026-10-18-30-days';
  if previous.user_id is distinct from target then raise exception 'Concessao anterior pertence a outra conta. Nenhuma alteracao realizada.'; end if;
end $$;
select user_id,starts_at,expires_at,revoked_at from public.admin_vip_grants
  where request_key='tester-matsakteste-2026-10-18-30-days';
commit;
