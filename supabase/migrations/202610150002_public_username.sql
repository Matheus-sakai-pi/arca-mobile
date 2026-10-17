begin;

-- Existing names/handles remain untouched until their owner chooses a public handle.
create unique index profiles_claimed_username on public.profiles(lower(username))
  where display_name='@'||username;

create function public.learning_username_available(p_username text) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare candidate text := lower(regexp_replace(btrim(p_username),'^@',''));
begin
  if candidate is null or candidate !~ '^[a-z0-9_]{3,30}$' then raise exception 'username_invalid'; end if;
  return not exists(select 1 from public.profiles where lower(username)=candidate and id is distinct from auth.uid());
end;
$$;

create function public.enforce_public_username() returns trigger
language plpgsql security definer set search_path='' as $$
declare candidate text;
begin
  if tg_op='UPDATE' and new.username is not distinct from old.username
    and new.display_name is not distinct from old.display_name then return new; end if;
  -- Old app versions may still provision an automatic handle. Do not rename these accounts.
  if tg_op='INSERT' and new.username='arca_'||replace(new.id::text,'-','')
    and new.display_name<>'@'||new.username then return new; end if;
  candidate := lower(regexp_replace(btrim(new.username),'^@',''));
  if candidate is null or candidate !~ '^[a-z0-9_]{3,30}$' then raise exception 'username_invalid'; end if;
  perform pg_advisory_xact_lock(hashtextextended('arca-public-username:'||candidate,0));
  if exists(select 1 from public.profiles where lower(username)=candidate and id<>new.id) then raise exception 'username_taken'; end if;
  new.username := candidate;
  new.display_name := '@'||candidate;
  return new;
end;
$$;
create trigger profiles_public_username before insert or update of username,display_name on public.profiles
  for each row execute function public.enforce_public_username();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path='' as $$
declare candidate text := new.raw_user_meta_data->>'username'; legacy_name text := btrim(coalesce(new.raw_user_meta_data->>'display_name',''));
begin
  if candidate is not null then
    candidate := lower(regexp_replace(btrim(candidate),'^@',''));
    if candidate !~ '^[a-z0-9_]{3,30}$' then raise exception 'username_invalid'; end if;
    insert into public.profiles(id,username,display_name) values(new.id,candidate,'@'||candidate);
  else
    insert into public.profiles(id,username,display_name) values(new.id,'arca_'||replace(new.id::text,'-',''),
      case when char_length(legacy_name)>=2 then left(legacy_name,60) else 'Estudante' end);
  end if;
  return new;
end;
$$;

revoke all on function public.learning_username_available(text),public.enforce_public_username(),public.handle_new_user() from public,anon,authenticated;
grant execute on function public.learning_username_available(text) to anon,authenticated;
notify pgrst,'reload schema';
commit;
