begin;
-- Keep consent, quiet hours, frequency limits and dispatcher permissions unchanged.
create or replace function public.push_claim(p_limit integer default 25) returns jsonb
language plpgsql security definer set search_path='' as $$
declare prefs public.push_preferences; wallet public.battery_wallets; target text;
  due timestamptz; event text; category text; job uuid; result jsonb:='[]'::jsonb; count integer:=0; local_hour integer;
  rules jsonb:=public.battery_config(); cap integer:=(rules->>'capacity')::integer; seconds integer:=(rules->>'refillSeconds')::integer;
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
      select * into wallet from public.battery_wallets where user_id=prefs.user_id;
      if found and wallet.balance<cap and wallet.refill_at is not null then
        due:=case when wallet.balance=0 then wallet.refill_at else wallet.refill_at+(cap-wallet.balance-1)*seconds*interval '1 second' end;
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

create or replace function public.arca_admin_energy() returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  if not public.arca_is_admin() then raise exception 'admin_required'; end if;
  select jsonb_build_object('enabled',c.enabled,'rollout',c.rollout,'updatedAt',c.updated_at,
    'wallets',(select count(*) from public.battery_wallets),
    'paidStarts7',(select count(distinct (e.wallet_id,e.attempt_id)) from public.battery_events e where (e.receipt->>'charged')::integer>0 and e.created_at>=now()-interval '7 days'),
    'completedPaid7',(select count(distinct (e.wallet_id,e.attempt_id)) from public.battery_events e join public.battery_sessions s on s.wallet_id=e.wallet_id and s.attempt_id=e.attempt_id where (e.receipt->>'charged')::integer>0 and s.completed and e.created_at>=now()-interval '7 days'),
    'blockedUsers7',(select count(distinct user_id) from public.learning_energy_daily where day>=(now() at time zone 'UTC')::date-6),
    'blocks7',(select coalesce(sum(blocked),0) from public.learning_energy_daily where day>=(now() at time zone 'UTC')::date-6),
    'returnedUsers7',(select count(distinct d.user_id) from public.learning_energy_daily d where d.day>=(now() at time zone 'UTC')::date-6 and exists(select 1 from public.lesson_attempts a where a.user_id=d.user_id and a.created_at>d.last_blocked_at))) into result
    from public.learning_energy_config c where singleton;
  return result;
end;
$$;
commit;
