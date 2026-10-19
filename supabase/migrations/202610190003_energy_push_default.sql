-- Aviso de energia ligado por padrão. Quem já escolheu (inclusive quem desligou) mantém a escolha:
-- só contas sem preferência salva passam a começar com o aviso de energia ligado.
-- O Android ainda pede a permissão de notificações; sem ela nada é enviado.
alter table public.push_preferences alter column energy set default true;

create or replace function public.learning_push_preferences(p_energy boolean default null,p_comeback boolean default null,p_timezone text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare owner uuid:=auth.uid(); prefs public.push_preferences;
begin
  if owner is null then raise exception 'auth_required'; end if;
  if p_timezone is not null and not exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then raise exception 'timezone_invalid'; end if;
  if p_energy is null and p_comeback is null and p_timezone is null then
    select * into prefs from public.push_preferences where user_id=owner;
    return jsonb_build_object('energy',coalesce(prefs.energy,true),'comeback',coalesce(prefs.comeback,false),'timezone',coalesce(prefs.timezone,'America/Sao_Paulo'));
  end if;
  insert into public.push_preferences(user_id) values(owner) on conflict do nothing;
  update public.push_preferences set energy=coalesce(p_energy,energy),comeback=coalesce(p_comeback,comeback),timezone=coalesce(p_timezone,timezone)
    where user_id=owner returning * into prefs;
  if not prefs.energy and not prefs.comeback then delete from public.push_devices where user_id=owner; end if;
  return jsonb_build_object('energy',prefs.energy,'comeback',prefs.comeback,'timezone',prefs.timezone);
end;
$$;

create or replace function public.learning_push_register(p_token text,p_timezone text default null,p_previous text default null) returns void
language plpgsql security definer set search_path='' as $$
declare owner uuid:=auth.uid(); prefs public.push_preferences;
begin
  if owner is null then raise exception 'auth_required'; end if;
  -- Quem nunca escolheu ganha a preferência padrão (aviso de energia ligado) ao permitir notificações.
  insert into public.push_preferences(user_id) values(owner) on conflict do nothing;
  select * into prefs from public.push_preferences where user_id=owner for update;
  if not (prefs.energy or prefs.comeback) then raise exception 'push_consent_required'; end if;
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
