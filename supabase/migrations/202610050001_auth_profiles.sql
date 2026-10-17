-- Phase 2 only: identity provisioning, independent of learning tables.
begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (char_length(username) between 3 and 60),
  display_name text not null check (char_length(display_name) between 2 and 60),
  avatar_url text,
  xp integer not null default 0 check (xp >= 0),
  current_streak integer not null default 0 check (current_streak >= 0),
  longest_streak integer not null default 0 check (longest_streak >= current_streak),
  last_activity_date date,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (username, display_name, avatar_url) on public.profiles to authenticated;

create policy "Read own profile" on public.profiles for select to authenticated
  using ((select auth.uid()) = id);
create policy "Update own identity" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  candidate text := trim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    'arca_' || replace(new.id::text, '-', ''),
    case when char_length(candidate) >= 2 then left(candidate, 60) else 'Estudante' end
  );
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Provision users who were registered before this migration was applied.
insert into public.profiles (id, username, display_name)
select id, 'arca_' || replace(id::text, '-', ''),
  case when char_length(trim(coalesce(raw_user_meta_data ->> 'display_name', ''))) >= 2
    then left(trim(raw_user_meta_data ->> 'display_name'), 60) else 'Estudante' end
from auth.users on conflict (id) do nothing;

commit;
