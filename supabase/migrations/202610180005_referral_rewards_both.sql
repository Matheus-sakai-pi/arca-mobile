begin;

create or replace function public.membership_claim_referral(p_invitee uuid) returns void
language plpgsql security definer set search_path='' as $$
declare r public.learning_referrals; days integer; inserted text;
begin
  select * into r from public.learning_referrals where invitee=p_invitee for update;
  if not found or r.rewarded_at is not null or r.blocked or r.inviter is null or r.device_hash is null then return; end if;
  -- Only a complete, non-imported lesson validated by the server qualifies.
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
  -- Both benefits and the receipt commit together; stable order avoids reversed row locks.
  insert into public.referral_benefits(user_id,unlimited_until)
    select recipient,now()+days*interval '1 day'
    from unnest(array[r.inviter,r.invitee]) as recipients(recipient) order by recipient
    on conflict(user_id) do update set unlimited_until=greatest(now(),public.referral_benefits.unlimited_until)+days*interval '1 day';
  update public.learning_referrals set rewarded_at=now() where invitee=p_invitee;
end;
$$;

revoke all on function public.membership_claim_referral(uuid) from public,anon,authenticated;

commit;
