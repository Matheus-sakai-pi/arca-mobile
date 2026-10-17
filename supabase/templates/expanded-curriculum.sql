-- Additive expansion: never delete lessons, receipts, profiles or XP events.
begin;
-- CURRENT_CURRICULUM

-- Retain the pre-expansion route for attempts queued by an existing account.
-- The timestamp is set once; rerunning the seed cannot expand this entitlement.
alter table public.courses add column if not exists curriculum_expanded_at timestamptz;
update public.courses set curriculum_expanded_at=now() where id='biblia-basica' and curriculum_expanded_at is null;

create or replace function public.valid_learning_completion_ids(p_ids jsonb) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare n integer; history text[]; baseline text[]; expected jsonb; prefix_size integer;
begin
  if jsonb_typeof(p_ids) is distinct from 'array' then return false; end if;
  n := jsonb_array_length(p_ids);
  if (select count(distinct value) from jsonb_array_elements(p_ids)) <> n then return false; end if;
  if exists(select 1 from jsonb_array_elements(p_ids) item where jsonb_typeof(item) <> 'string'
    or not exists(select 1 from public.lessons l join public.units u on u.id=l.unit_id
      where to_jsonb(l.id)=item and l.published and u.published and u.course_id='biblia-basica')) then return false; end if;
  foreach history slice 1 in array array[
    array['o-que-e-a-biblia','antigo-e-novo-testamento','organizacao-da-biblia','personagens-importantes','revisao',null,null,null],
    array['o-que-e-a-biblia','antigo-e-novo-testamento','organizacao-da-biblia','revisao','personagens-importantes','criacao-noe-e-abraao','moises-e-davi','jesus-e-paulo']
  ] loop
    history := array_remove(history,null);
    for prefix_size in 0..least(n,cardinality(history)) loop
      baseline := history[1:prefix_size];
      if not (p_ids @> to_jsonb(baseline)) then continue; end if;
      select to_jsonb(baseline) || coalesce(jsonb_agg(id order by unit_order,lesson_order),'[]'::jsonb) into expected from (
        select l.id,u.order_index unit_order,l.order_index lesson_order from public.lessons l join public.units u on u.id=l.unit_id
        where l.published and u.published and u.course_id='biblia-basica' and not (l.id=any(baseline))
        order by u.order_index,l.order_index limit (n-prefix_size)
      ) remaining;
      if jsonb_array_length(expected)=n and p_ids @> expected and expected @> p_ids then return true; end if;
    end loop;
  end loop;
  return false;
end;
$$;

create or replace function public.assert_lesson_available(p_user uuid, p_lesson text) returns void
language plpgsql security definer set search_path = '' as $$
declare target public.lessons; target_unit public.units; history text[]; position integer;
begin
  select l.* into target from public.lessons l join public.units u on u.id=l.unit_id
    join public.courses c on c.id=u.course_id where l.id=p_lesson and l.published and u.published and c.published;
  if not found then raise exception 'content_unavailable'; end if;
  select * into target_unit from public.units where id=target.unit_id;
  if exists(select 1 from public.user_lesson_progress where user_id=p_user and lesson_id=p_lesson and status in ('completed','mastered')) then return; end if;
  -- Existing accounts may replay their old sequential outbox even if the old
  -- next lesson was started offline. Accounts created after this upgrade must
  -- follow all 100 lessons; every old predecessor is still required here.
  if exists(select 1 from public.profiles p join public.courses c on c.id=target_unit.course_id
      where p.id=p_user and p.created_at<c.curriculum_expanded_at)
    or exists(select 1 from public.user_lesson_progress where user_id=p_user and lesson_id=p_lesson and status in ('available','in_progress')) then
    foreach history slice 1 in array array[
      array['o-que-e-a-biblia','antigo-e-novo-testamento','organizacao-da-biblia','personagens-importantes','revisao',null,null,null],
      array['o-que-e-a-biblia','antigo-e-novo-testamento','organizacao-da-biblia','revisao','personagens-importantes','criacao-noe-e-abraao','moises-e-davi','jesus-e-paulo']
    ] loop
      history := array_remove(history,null);
      position := array_position(history,p_lesson);
      if position is not null and not exists(select 1 from unnest(history[1:position-1]) as previous_lesson(id)
        where not exists(select 1 from public.user_lesson_progress p where p.user_id=p_user and p.lesson_id=previous_lesson.id and p.status in ('completed','mastered'))) then return; end if;
    end loop;
  end if;
  if exists(select 1 from public.lessons l join public.units u on u.id=l.unit_id
    where u.course_id=target_unit.course_id and u.published and l.published
      and (u.order_index<target_unit.order_index or (u.id=target_unit.id and l.order_index<target.order_index))
      and not exists(select 1 from public.user_lesson_progress p where p.user_id=p_user and p.lesson_id=l.id and p.status in ('completed','mastered')))
    then raise exception 'lesson_locked'; end if;
end;
$$;

create or replace function public.import_guest_progress(p_source_id text, p_completed_ids jsonb, p_xp integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare owner uuid:=auth.uid(); source_owner uuid; n integer; max_xp integer;
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
  if n=0 or not public.valid_learning_completion_ids(p_completed_ids) then raise exception 'guest_invalid'; end if;
  select coalesce(sum(10+2*(select count(*) from public.questions q where q.lesson_id=l.id and q.type<>'content_card' and q.order_index<1000)+5),0)::integer into max_xp
    from public.lessons l where l.id in(select jsonb_array_elements_text(p_completed_ids));
  if p_xp<n*10 or p_xp>max_xp then raise exception 'guest_invalid'; end if;
  remaining:=p_xp-n*10;
  for imported_lesson_id in select jsonb_array_elements_text(p_completed_ids) loop
    select 10+least(remaining,2*count(*)::integer+5) into award from public.questions q where q.lesson_id=imported_lesson_id and q.type<>'content_card' and q.order_index<1000;
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
revoke all on function public.valid_learning_completion_ids(jsonb),public.assert_lesson_available(uuid,text) from public,anon,authenticated;
revoke all on function public.import_guest_progress(text,jsonb,integer) from public,anon;
grant execute on function public.import_guest_progress(text,jsonb,integer) to authenticated;
commit;
