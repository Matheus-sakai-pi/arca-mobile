begin;

create table public.profile_photo_requests (
  id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  input_hash text not null check(input_hash ~ '^[a-f0-9]{64}$'),
  state text not null default 'uploading' check(state in ('uploading','pending','approved','rejected','removed','cancelled','superseded')),
  reason text not null default '' check(char_length(reason)<=300),
  terms_version integer not null default 1 check(terms_version=1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null
);
create index profile_photos_queue on public.profile_photo_requests(state,created_at desc,id);
create index profile_photos_owner on public.profile_photo_requests(user_id,created_at desc);
create unique index profile_photos_one_pending on public.profile_photo_requests(user_id) where state in ('uploading','pending');
create table public.profile_photo_restrictions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  reason text not null,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create table public.profile_photo_reports (
  photo_id uuid references public.profile_photo_requests(id) on delete cascade,
  reporter uuid references public.profiles(id) on delete cascade,
  reason text not null check(reason in ('sexual','violence','privacy','other')),
  created_at timestamptz not null default now(),
  primary key(photo_id,reporter)
);
create table public.learning_user_blocks (
  blocker uuid references public.profiles(id) on delete cascade,
  blocked uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(blocker,blocked),check(blocker<>blocked)
);
alter table public.profile_photo_requests enable row level security;
alter table public.profile_photo_restrictions enable row level security;
alter table public.profile_photo_reports enable row level security;
alter table public.learning_user_blocks enable row level security;
revoke all on public.profile_photo_requests,public.profile_photo_restrictions,public.profile_photo_reports,public.learning_user_blocks from public,anon,authenticated;

-- All bytes are decoded and re-encoded by the service-only upload function.
create function public.profile_photo_ingest(p_user uuid,p_id uuid,p_hash text,p_stage text) returns text
language plpgsql security definer set search_path='' as $$
declare item public.profile_photo_requests;
begin
  perform 1 from public.profiles where id=p_user for update;
  if not found or public.membership_vip_until(p_user) is null then raise exception 'vip_required'; end if;
  if exists(select 1 from public.profile_photo_restrictions where user_id=p_user) then raise exception 'photo_restricted'; end if;
  if p_id is null or p_hash is null or p_hash !~ '^[a-f0-9]{64}$' or p_stage not in ('reserve','finish','abort') or p_stage is null then raise exception 'photo_invalid'; end if;
  select * into item from public.profile_photo_requests where id=p_id for update;
  if found then
    if item.user_id<>p_user or item.input_hash<>p_hash then raise exception 'photo_conflict'; end if;
    if p_stage='finish' and item.state='uploading' then
      update public.profile_photo_requests set state='pending',updated_at=now() where id=p_id;
      return 'pending';
    elsif p_stage='abort' and item.state='uploading' then
      update public.profile_photo_requests set state='cancelled',updated_at=now() where id=p_id;
      return 'cancelled';
    end if;
    return case when p_stage='reserve' and item.state='uploading' then 'busy' else item.state end;
  end if;
  if p_stage<>'reserve' then raise exception 'photo_missing'; end if;
  -- Failed uploads expire, but still count towards the daily quota.
  update public.profile_photo_requests set state='cancelled',updated_at=now()
    where user_id=p_user and state='uploading' and created_at<now()-interval '15 minutes';
  if exists(select 1 from public.profile_photo_requests where user_id=p_user and state in ('pending','uploading')) then raise exception 'photo_pending'; end if;
  if (select count(*) from public.profile_photo_requests where user_id=p_user and created_at>now()-interval '24 hours')>=5 then raise exception 'photo_limit'; end if;
  insert into public.profile_photo_requests(id,user_id,input_hash) values(p_id,p_user,p_hash);
  return 'uploading';
end;
$$;

create function public.profile_photo_can_read(p_path text) returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists (
    select 1 from public.profile_photo_requests r join public.profiles p on p.id=r.user_id
    where p_path=r.user_id::text||'/'||r.id::text||'.jpg'
      and (public.arca_is_admin() or r.user_id=auth.uid() or
        (r.state='approved' and p.avatar_key='photo:'||r.id::text and public.membership_vip_until(r.user_id) is not null
          and not exists(select 1 from public.learning_user_blocks b where (b.blocker=auth.uid() and b.blocked=r.user_id) or (b.blocked=auth.uid() and b.blocker=r.user_id))))
  )
$$;

create function public.learning_profile_photo(p_action text default 'status',p_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare owner uuid:=auth.uid(); item public.profile_photo_requests; latest jsonb;
begin
  if owner is null then raise exception 'auth_required'; end if;
  perform 1 from public.profiles where id=owner for update;
  if p_action in ('cancel','remove') then
    select * into item from public.profile_photo_requests where id=p_id and user_id=owner for update;
    if not found then raise exception 'photo_missing'; end if;
    if p_action='cancel' and item.state not in ('uploading','pending','cancelled') then raise exception 'photo_conflict'; end if;
    if p_action='remove' and item.state not in ('approved','removed') then raise exception 'photo_conflict'; end if;
    update public.profile_photo_requests set state=case when p_action='cancel' then 'cancelled' else 'removed' end,updated_at=now() where id=p_id;
    update public.profiles set avatar_key='avatar-01' where id=owner and avatar_key='photo:'||p_id::text;
  elsif p_action<>'status' or p_action is null then raise exception 'photo_invalid'; end if;
  select jsonb_build_object('id',id,'state',state,'reason',reason,'updatedAt',updated_at) into latest
    from public.profile_photo_requests where user_id=owner order by created_at desc,id desc limit 1;
  return jsonb_build_object('owner',owner,'vip',public.membership_vip_until(owner) is not null,
    'restricted',exists(select 1 from public.profile_photo_restrictions where user_id=owner),'latest',latest);
end;
$$;

create function public.learning_profile_photo_view(p_id uuid,p_preview boolean default false) returns text
language sql stable security definer set search_path='' as $$
  select r.user_id::text||'/'||r.id::text||'.jpg' from public.profile_photo_requests r join public.profiles p on p.id=r.user_id
    where r.id=p_id and public.profile_photo_can_read(r.user_id::text||'/'||r.id::text||'.jpg')
      and ((p_preview and r.user_id=auth.uid()) or
        (r.state='approved' and p.avatar_key='photo:'||r.id::text and public.membership_vip_until(r.user_id) is not null
          and not exists(select 1 from public.learning_user_blocks b where (b.blocker=auth.uid() and b.blocked=r.user_id) or (b.blocked=auth.uid() and b.blocker=r.user_id))))
$$;

create function public.enforce_profile_photo() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.avatar_key like 'photo:%' and (tg_op='INSERT' or new.avatar_key is distinct from old.avatar_key) then
    if not exists(select 1 from public.profile_photo_requests where 'photo:'||id::text=new.avatar_key and user_id=new.id and state='approved')
      or public.membership_vip_until(new.id) is null then raise exception 'photo_not_approved'; end if;
  end if;
  return new;
end;
$$;
create trigger profiles_photo_guard before insert or update of avatar_key on public.profiles for each row execute function public.enforce_profile_photo();

create function public.arca_admin_photos(p_filter text default 'pending',p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if not public.arca_is_admin() then raise exception 'admin_required'; end if;
  if p_filter not in ('pending','approved','rejected','removed','reported') or p_filter is null or p_offset is null or p_offset<0 or p_offset>100000 then raise exception 'photo_invalid'; end if;
  select jsonb_build_object('pending',(select count(*) from public.profile_photo_requests where state='pending'),
    'total',(select count(*) from public.profile_photo_requests r where case when p_filter='reported' then r.state='approved' and exists(select 1 from public.profile_photo_reports where photo_id=r.id) else r.state=p_filter end),
    'offset',p_offset,'items',coalesce(jsonb_agg(to_jsonb(item) order by item."createdAt",item.id),'[]'::jsonb)) into result from (
      select r.id,r.user_id "userId",p.display_name name,r.state,r.reason,r.created_at "createdAt",r.updated_at "updatedAt",
        r.user_id::text||'/'||r.id::text||'.jpg' path,
        exists(select 1 from public.profile_photo_restrictions where user_id=r.user_id) restricted,
        (select count(*) from public.profile_photo_reports where photo_id=r.id) reports
      from public.profile_photo_requests r join public.profiles p on p.id=r.user_id
      where case when p_filter='reported' then r.state='approved' and exists(select 1 from public.profile_photo_reports where photo_id=r.id) else r.state=p_filter end
      order by r.created_at,r.id limit 20 offset p_offset
    ) item;
  return result;
end;
$$;

create function public.arca_admin_photo_review(p_id uuid,p_action text,p_expected timestamptz,p_reason text default '',p_restrict boolean default false) returns void
language plpgsql security definer set search_path='' as $$
declare item public.profile_photo_requests; owner uuid;
begin
  if not public.arca_is_admin() then raise exception 'admin_required'; end if;
  select user_id into owner from public.profile_photo_requests where id=p_id;
  perform 1 from public.profiles where id=owner for update;
  select * into item from public.profile_photo_requests where id=p_id for update;
  if not found or p_expected is null or item.updated_at<>p_expected then raise exception 'photo_conflict'; end if;
  if p_action='allow_upload' then
    delete from public.profile_photo_restrictions where user_id=owner;
    update public.profile_photo_requests set updated_at=now() where id=p_id;
    return;
  end if;
  if p_action not in ('approve','reject','remove') or p_action is null then raise exception 'photo_invalid'; end if;
  if (p_action in ('approve','reject') and item.state<>'pending') or (p_action='remove' and item.state<>'approved') then raise exception 'photo_conflict'; end if;
  if p_action<>'approve' and (p_reason is null or char_length(btrim(p_reason)) not between 1 and 300) then raise exception 'photo_reason_required'; end if;
  if p_action='approve' then
    if public.membership_vip_until(owner) is null then raise exception 'vip_required'; end if;
    if exists(select 1 from public.profile_photo_restrictions where user_id=owner) then raise exception 'photo_restricted'; end if;
    update public.profile_photo_requests set state='superseded',updated_at=now() where user_id=owner and state='approved';
  end if;
  update public.profile_photo_requests set state=case p_action when 'approve' then 'approved' when 'reject' then 'rejected' else 'removed' end,
    reason=case when p_action='approve' then '' else btrim(p_reason) end,reviewed_by=auth.uid(),updated_at=now() where id=p_id;
  if p_action='approve' then
    update public.profiles set avatar_key='photo:'||p_id::text where id=owner;
  elsif p_action='remove' then
    update public.profiles set avatar_key='avatar-01' where id=owner and avatar_key='photo:'||p_id::text;
  end if;
  if p_action<>'approve' and p_restrict then
    insert into public.profile_photo_restrictions(user_id,reason,reviewed_by) values(owner,btrim(p_reason),auth.uid())
      on conflict(user_id) do update set reason=excluded.reason,reviewed_by=excluded.reviewed_by,created_at=now();
  end if;
end;
$$;

create function public.learning_photo_safety(p_id uuid,p_action text,p_reason text default 'other') returns void
language plpgsql security definer set search_path='' as $$
declare owner uuid:=auth.uid(); target uuid;
begin
  if owner is null then raise exception 'auth_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('photo-safety:'||owner::text,0));
  select user_id into target from public.profile_photo_requests where id=p_id and state='approved';
  if target is null or target=owner then raise exception 'photo_missing'; end if;
  if p_action='report' then
    if p_reason not in ('sexual','violence','privacy','other') or p_reason is null then raise exception 'photo_invalid'; end if;
    if not exists(select 1 from public.profile_photo_reports where reporter=owner and photo_id=p_id)
      and (select count(*) from public.profile_photo_reports where reporter=owner and created_at>now()-interval '24 hours')>=20 then raise exception 'photo_limit'; end if;
    insert into public.profile_photo_reports(photo_id,reporter,reason) values(p_id,owner,p_reason) on conflict do nothing;
  elsif p_action='block' then
    insert into public.learning_user_blocks(blocker,blocked) values(owner,target) on conflict do nothing;
    delete from public.learning_friendships where person_a=least(owner,target) and person_b=greatest(owner,target);
    update public.learning_challenges set status='cancelled' where status in ('pending','accepted') and ((sender=owner and recipient=target) or (sender=target and recipient=owner));
  elsif p_action='unblock' then
    delete from public.learning_user_blocks where blocker=owner and blocked=target;
  else raise exception 'photo_invalid'; end if;
end;
$$;

create function public.learning_photo_blocks(p_user uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'auth_required'; end if;
  if p_user is not null then delete from public.learning_user_blocks where blocker=auth.uid() and blocked=p_user; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name) order by b.created_at desc),'[]'::jsonb)
    from public.learning_user_blocks b join public.profiles p on p.id=b.blocked where b.blocker=auth.uid());
end;
$$;

create function public.profile_photo_prepare_delete(p_user uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.profiles where id=p_user for update;
  if found then insert into public.profile_photo_restrictions(user_id,reason) values(p_user,'account_deletion') on conflict do nothing; end if;
end;
$$;

create function public.enforce_user_block() returns trigger
language plpgsql security definer set search_path='' as $$
declare first uuid; second uuid;
begin
  if tg_table_name='learning_friendships' then first:=new.person_a; second:=new.person_b;
  else first:=new.sender; second:=new.recipient; end if;
  if exists(select 1 from public.learning_user_blocks where (blocker=first and blocked=second) or (blocker=second and blocked=first)) then raise exception 'user_blocked'; end if;
  return new;
end;
$$;
create trigger friendships_block_guard before insert or update on public.learning_friendships for each row execute function public.enforce_user_block();
create trigger challenges_block_guard before insert on public.learning_challenges for each row execute function public.enforce_user_block();

-- Storage is present on Supabase. The pure SQL test database has no Storage API.
do $$ begin if to_regclass('storage.buckets') is not null then
  insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
    values('profile-photos','profile-photos',false,393216,array['image/jpeg'])
    on conflict(id) do update set public=false,file_size_limit=393216,allowed_mime_types=array['image/jpeg'];
  execute 'create policy profile_photos_private_read on storage.objects for select to authenticated using(bucket_id=''profile-photos'' and public.profile_photo_can_read(name))';
  execute 'create policy profile_photos_read_fence on storage.objects as restrictive for select to authenticated using(bucket_id<>''profile-photos'' or public.profile_photo_can_read(name))';
  execute 'create policy profile_photos_anon_fence on storage.objects as restrictive for select to anon using(bucket_id<>''profile-photos'')';
  execute 'create policy profile_photos_no_insert on storage.objects as restrictive for insert to anon,authenticated with check(bucket_id<>''profile-photos'')';
  execute 'create policy profile_photos_no_update on storage.objects as restrictive for update to anon,authenticated using(bucket_id<>''profile-photos'') with check(bucket_id<>''profile-photos'')';
  execute 'create policy profile_photos_no_delete on storage.objects as restrictive for delete to anon,authenticated using(bucket_id<>''profile-photos'')';
end if; end $$;

revoke all on function public.profile_photo_ingest(uuid,uuid,text,text),public.profile_photo_prepare_delete(uuid),public.enforce_profile_photo(),public.enforce_user_block(),
  public.profile_photo_can_read(text),public.learning_profile_photo(text,uuid),public.learning_profile_photo_view(uuid,boolean),public.learning_photo_blocks(uuid),
  public.arca_admin_photos(text,integer),public.arca_admin_photo_review(uuid,text,timestamptz,text,boolean),public.learning_photo_safety(uuid,text,text)
  from public,anon,authenticated;
grant execute on function public.profile_photo_can_read(text),public.learning_profile_photo(text,uuid),public.learning_profile_photo_view(uuid,boolean),public.learning_photo_blocks(uuid),
  public.arca_admin_photos(text,integer),public.arca_admin_photo_review(uuid,text,timestamptz,text,boolean),public.learning_photo_safety(uuid,text,text) to authenticated;
do $$ begin if exists(select 1 from pg_roles where rolname='service_role') then
  grant execute on function public.profile_photo_ingest(uuid,uuid,text,text) to service_role;
  grant execute on function public.profile_photo_prepare_delete(uuid) to service_role;
end if; end $$;
notify pgrst,'reload schema';
commit;
