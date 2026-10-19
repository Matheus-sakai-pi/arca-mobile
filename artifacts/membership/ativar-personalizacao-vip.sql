begin;

create table public.profile_appearance (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  frame_key text not null default 'classic' check(frame_key in ('classic','gold','laurel','starlight')),
  background_key text not null default 'plain' check(background_key in ('plain','garden','sky','stars')),
  show_badge boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.profile_appearance enable row level security;
revoke all on public.profile_appearance from public,anon,authenticated;

create function public.learning_profile_appearance(p_frame text default null,p_background text default null,p_badge boolean default null) returns jsonb
language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare owner uuid:=auth.uid(); choice public.profile_appearance; paid boolean;
  frame text; background text; badge boolean;
begin
  if owner is null then raise exception 'auth_required'; end if;
  paid:=coalesce(public.membership_vip_until(owner)>now(),false);
  -- Account identity is taken only from the authenticated session.
  perform 1 from public.profiles where id=owner for update;
  if not found then raise exception 'profile_missing'; end if;
  select * into choice from public.profile_appearance where user_id=owner;
  frame:=coalesce(p_frame,choice.frame_key,'classic');
  background:=coalesce(p_background,choice.background_key,'plain');
  badge:=coalesce(p_badge,choice.show_badge,true);
  if p_frame is not null or p_background is not null or p_badge is not null then
    if frame not in ('classic','gold','laurel','starlight') or background not in ('plain','garden','sky','stars') then
      raise exception 'appearance_invalid';
    end if;
    if (frame<>'classic' or background<>'plain') and not paid then raise exception 'vip_required'; end if;
    insert into public.profile_appearance(user_id,frame_key,background_key,show_badge)
      values(owner,frame,background,badge)
      on conflict(user_id) do update set frame_key=excluded.frame_key,background_key=excluded.background_key,
        show_badge=excluded.show_badge,updated_at=now();
  end if;
  return jsonb_build_object('owner',owner,'frame',frame,'background',background,'showBadge',badge,'vip',paid);
end;
$$;
revoke all on function public.learning_profile_appearance(text,text,boolean) from public,anon,authenticated;
grant execute on function public.learning_profile_appearance(text,text,boolean) to authenticated;

commit;
