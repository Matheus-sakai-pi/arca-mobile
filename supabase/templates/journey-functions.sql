-- Included by generate-seed.ts in the atomic curriculum migration.
create or replace function public.assert_lesson_available(p_user uuid, p_lesson text) returns void
language plpgsql security definer set search_path = '' as $$
declare target public.lessons; target_unit public.units;
begin
  select l.* into target from public.lessons l join public.units u on u.id=l.unit_id
    join public.courses c on c.id=u.course_id where l.id=p_lesson and l.published and u.published and c.published;
  if not found then raise exception 'content_unavailable'; end if;
  select * into target_unit from public.units where id=target.unit_id;
  -- Previously earned lessons remain reviewable after moving between units.
  if exists(select 1 from public.user_lesson_progress where user_id=p_user and lesson_id=p_lesson and status in ('completed','mastered')) then return; end if;
  -- Preserve a lesson unlocked before the move, including offline queued attempts.
  if p_lesson='personagens-importantes' and exists(select 1 from public.user_lesson_progress where user_id=p_user and lesson_id=p_lesson and status in ('available','in_progress'))
    and not exists(select 1 from public.lessons l where l.id in ('o-que-e-a-biblia','antigo-e-novo-testamento','organizacao-da-biblia')
      and not exists(select 1 from public.user_lesson_progress p where p.user_id=p_user and p.lesson_id=l.id and p.status in ('completed','mastered'))) then return; end if;
  if exists(select 1 from public.lessons l join public.units u on u.id=l.unit_id
    where u.course_id=target_unit.course_id and u.published and l.published
      and (u.order_index < target_unit.order_index or (u.id=target_unit.id and l.order_index < target.order_index))
      and not exists(select 1 from public.user_lesson_progress p where p.user_id=p_user and p.lesson_id=l.id and p.status in ('completed','mastered')))
    then raise exception 'lesson_locked'; end if;
end;
$$;

create or replace function public.learning_snapshot(p_unit text default 'conhecendo-a-biblia') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare owner uuid := auth.uid(); person public.profiles; completed jsonb; last_result jsonb; v_course_id text; root_id text;
begin
  if owner is null then raise exception 'auth_required'; end if;
  select * into person from public.profiles where id=owner;
  if not found then raise exception 'profile_missing'; end if;
  select u.course_id into v_course_id from public.units u where u.id=p_unit;
  if not found then raise exception 'content_unavailable'; end if;
  select u.id into root_id from public.units u where u.course_id=v_course_id and u.published order by u.order_index limit 1;
  select coalesce(jsonb_agg(l.id order by u.order_index,l.order_index),'[]'::jsonb) into completed
    from public.user_lesson_progress p join public.lessons l on l.id=p.lesson_id join public.units u on u.id=l.unit_id
    where p.user_id=owner and p.status in ('completed','mastered') and u.course_id=v_course_id and u.published and l.published;
  select a.result into last_result from public.lesson_attempts a join public.lessons l on l.id=a.lesson_id join public.units u on u.id=l.unit_id
    where a.user_id=owner and u.course_id=v_course_id and u.published and l.published order by a.created_at desc,a.id desc limit 1;
  return jsonb_build_object('unitId',root_id,'xp',person.xp_total,'completedLessonIds',completed,'lastResult',last_result,
    'profile',jsonb_build_object('id',owner,'display_name',person.display_name,'username',person.username,
      'avatar_key',person.avatar_key,'xp_total',person.xp_total,
      'current_streak',case when person.last_activity_date>=public.learning_day()-1 then person.current_streak else 0 end,
      'longest_streak',person.longest_streak,'last_activity_date',person.last_activity_date,'created_at',person.created_at,'updated_at',person.updated_at),
    'guestImported',exists(select 1 from public.guest_progress_imports where user_id=owner));
end;
$$;

create or replace function public.import_guest_progress(p_source_id text, p_completed_ids jsonb, p_xp integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare owner uuid:=auth.uid(); source_owner uuid; ids jsonb; legacy_ids jsonb; n integer; max_xp integer;
  remaining integer; award integer; imported_lesson_id text; lessons_added integer:=0; xp_added integer:=0;
begin
  if owner is null then raise exception 'auth_required'; end if;
  if p_source_id is null or char_length(p_source_id) not between 1 and 200 or jsonb_typeof(p_completed_ids) is distinct from 'array' or p_xp is null then raise exception 'guest_invalid'; end if;
  perform 1 from public.profiles where id=owner for update;
  if not found then raise exception 'profile_missing'; end if;
  if exists(select 1 from public.guest_progress_imports where user_id=owner) then return public.learning_snapshot(); end if;
  perform pg_advisory_xact_lock(hashtextextended(p_source_id,0));
  select user_id into source_owner from public.guest_progress_imports where source_id=p_source_id;
  if found and source_owner<>owner then raise exception 'guest_already_imported'; end if;
  n:=jsonb_array_length(p_completed_ids);
  select coalesce(jsonb_agg(id order by unit_order,lesson_order),'[]'::jsonb) into ids from
    (select l.id,u.order_index unit_order,l.order_index lesson_order from public.lessons l join public.units u on u.id=l.unit_id
      where u.course_id='biblia-basica' and u.published and l.published order by u.order_index,l.order_index limit n) ordered;
  select coalesce(jsonb_agg(id order by ordinal),'[]'::jsonb) into legacy_ids from
    unnest(array['o-que-e-a-biblia','antigo-e-novo-testamento','organizacao-da-biblia','personagens-importantes','revisao']) with ordinality as legacy(id,ordinal) where ordinal<=n;
  -- Legacy data may use old order or canonical order after local normalization.
  if n=0 or (ids<>p_completed_ids and (n>5 or jsonb_array_length(legacy_ids)<>n or not (legacy_ids @> p_completed_ids and p_completed_ids @> legacy_ids))) then raise exception 'guest_invalid'; end if;
  if (select count(distinct value) from jsonb_array_elements(p_completed_ids))<>n then raise exception 'guest_invalid'; end if;
  select coalesce(sum(10+2*(select count(*) from public.questions q where q.lesson_id=l.id and q.type<>'content_card')+5),0)::integer into max_xp
    from public.lessons l where l.id in(select jsonb_array_elements_text(p_completed_ids));
  if p_xp<n*10 or p_xp>max_xp then raise exception 'guest_invalid'; end if;
  remaining:=p_xp-n*10;
  for imported_lesson_id in select jsonb_array_elements_text(p_completed_ids) loop
    select 10+least(remaining,2*count(*)::integer+5) into award from public.questions q where q.lesson_id=imported_lesson_id and q.type<>'content_card';
    remaining:=remaining-(award-10);
    if not exists(select 1 from public.user_lesson_progress p where p.user_id=owner and p.lesson_id=imported_lesson_id and p.status in ('completed','mastered')) then
      insert into public.user_lesson_progress(user_id,lesson_id,status,xp_earned,completed_at) values(owner,imported_lesson_id,'completed',award,now())
        on conflict(user_id,lesson_id) do update set status='completed',xp_earned=excluded.xp_earned,completed_at=now(),updated_at=now();
      insert into public.xp_events(user_id,lesson_id,amount,reason) values(owner,imported_lesson_id,award,'guest_import');
      lessons_added:=lessons_added+1; xp_added:=xp_added+award;
    end if;
  end loop;
  insert into public.guest_progress_imports(user_id,source_id,snapshot) values(owner,p_source_id,jsonb_build_object('completedLessonIds',p_completed_ids,'xp',p_xp));
  update public.profiles set xp_total=xp_total+xp_added where id=owner;
  if lessons_added>0 then perform public.record_learning_activity(owner,lessons_added,xp_added); end if;
  return public.learning_snapshot();
end;
$$;
revoke all on function public.assert_lesson_available(uuid,text) from public,anon,authenticated;
revoke all on function public.learning_snapshot(text),public.import_guest_progress(text,jsonb,integer) from public,anon;
grant execute on function public.learning_snapshot(text),public.import_guest_progress(text,jsonb,integer) to authenticated;
