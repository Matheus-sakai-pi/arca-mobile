-- Conquistas e preferências da conta guardadas no servidor, para não se perderem ao trocar de aparelho.
-- Conquistas só se acumulam (união); preferências guardam o último valor enviado.
create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  achievements text[] not null default '{}',
  preferences jsonb,
  updated_at timestamptz not null default now()
);
alter table public.user_settings enable row level security;
revoke all on public.user_settings from public,anon,authenticated;

create function public.learning_user_settings(p_achievements text[] default null,p_preferences jsonb default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  owner uuid:=auth.uid();
  settings public.user_settings;
  known text[]:=array['first_step','perfect_lesson','streak_3','streak_7','scholar','unit_1','unit_2','xp_500','xp_1000'];
begin
  if owner is null then raise exception 'auth_required'; end if;
  if p_achievements is not null and (cardinality(p_achievements) > 50 or not (p_achievements <@ known)) then raise exception 'settings_invalid'; end if;
  if p_preferences is not null and not (
    jsonb_typeof(p_preferences)='object'
    and (select count(*) from jsonb_object_keys(p_preferences))=4
    and jsonb_typeof(p_preferences->'soundEnabled')='boolean'
    and jsonb_typeof(p_preferences->'hapticsEnabled')='boolean'
    and jsonb_typeof(p_preferences->'reduceMotion')='boolean'
    and jsonb_typeof(p_preferences->'dailyGoal')='number'
    and (p_preferences->>'dailyGoal') in ('10','20','30')
  ) then raise exception 'settings_invalid'; end if;
  if p_achievements is null and p_preferences is null then
    select * into settings from public.user_settings where user_id=owner;
  else
    insert into public.user_settings(user_id) values(owner) on conflict do nothing;
    update public.user_settings set
      achievements=case when p_achievements is null then achievements
        else (select coalesce(array_agg(distinct item order by item),'{}') from unnest(achievements||p_achievements) as item) end,
      preferences=coalesce(p_preferences,preferences),
      updated_at=now()
    where user_id=owner returning * into settings;
  end if;
  return jsonb_build_object('achievements',to_jsonb(coalesce(settings.achievements,'{}'::text[])),'preferences',settings.preferences);
end $$;

revoke all on function public.learning_user_settings(text[],jsonb) from public,anon,authenticated;
grant execute on function public.learning_user_settings(text[],jsonb) to authenticated;
