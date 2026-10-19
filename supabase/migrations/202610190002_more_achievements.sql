-- Mais conquistas no app: o servidor passa a aceitar as novas metas sem lista fixa de nomes.
create or replace function public.learning_user_settings(p_achievements text[] default null,p_preferences jsonb default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  owner uuid:=auth.uid();
  settings public.user_settings;
begin
  if owner is null then raise exception 'auth_required'; end if;
  -- Aceita as conquistas conhecidas e as próximas metas numéricas (unidades, lições, sequência, XP)
  -- sem precisar de nova atualização no banco a cada conquista criada no app.
  if p_achievements is not null and (cardinality(p_achievements) > 100 or exists(
    select 1 from unnest(p_achievements) as item
    where item is null or item !~ '^(first_step|perfect_lesson|scholar|course_complete|(streak|lessons|xp|unit)_[0-9]{1,6})$'
  )) then raise exception 'settings_invalid'; end if;
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
