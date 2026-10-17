begin;

create function public.learning_day() returns date
language sql stable set search_path = '' as $$ select (now() at time zone 'UTC')::date $$;

create function public.record_learning_activity(p_user uuid, p_lessons integer, p_xp integer) returns void
language plpgsql security definer set search_path = '' as $$
declare day date := public.learning_day(); streak integer;
begin
  insert into public.user_daily_activity(user_id, activity_date, lessons_completed, xp_earned)
    values(p_user, day, p_lessons, p_xp)
    on conflict(user_id, activity_date) do update set
      lessons_completed = public.user_daily_activity.lessons_completed + excluded.lessons_completed,
      xp_earned = public.user_daily_activity.xp_earned + excluded.xp_earned;
  with recursive consecutive(activity_date) as (
    select day
    union all select c.activity_date - 1 from consecutive c
      where exists(select 1 from public.user_daily_activity a where a.user_id = p_user and a.activity_date = c.activity_date - 1)
  ) select count(*)::integer into streak from consecutive;
  update public.profiles set current_streak = streak,
    longest_streak = greatest(longest_streak, streak), last_activity_date = day where id = p_user;
end;
$$;

create function public.assert_lesson_available(p_user uuid, p_lesson text) returns void
language plpgsql security definer set search_path = '' as $$
declare target public.lessons;
begin
  select l.* into target from public.lessons l join public.units u on u.id = l.unit_id
    join public.courses c on c.id = u.course_id where l.id = p_lesson and l.published and u.published and c.published;
  if not found then raise exception 'content_unavailable'; end if;
  if exists(select 1 from public.lessons previous where previous.unit_id = target.unit_id and previous.published
    and previous.order_index < target.order_index and not exists(select 1 from public.user_lesson_progress p
      where p.user_id = p_user and p.lesson_id = previous.id and p.status in ('completed','mastered')))
  then raise exception 'lesson_locked'; end if;
end;
$$;

create function public.learning_snapshot(p_unit text default 'conhecendo-a-biblia') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare owner uuid := auth.uid(); person public.profiles; completed jsonb; last_result jsonb;
begin
  if owner is null then raise exception 'auth_required'; end if;
  select * into person from public.profiles where id = owner;
  if not found then raise exception 'profile_missing'; end if;
  select coalesce(jsonb_agg(l.id order by l.order_index), '[]'::jsonb) into completed
    from public.user_lesson_progress p join public.lessons l on l.id = p.lesson_id
    where p.user_id = owner and p.status in ('completed','mastered') and l.unit_id = p_unit;
  select a.result into last_result from public.lesson_attempts a join public.lessons l on l.id = a.lesson_id
    where a.user_id = owner and l.unit_id = p_unit order by a.created_at desc, a.id desc limit 1;
  return jsonb_build_object('unitId',p_unit,'xp',person.xp_total,'completedLessonIds',completed,'lastResult',last_result,
    'profile', jsonb_build_object('id',owner,'display_name',person.display_name,'username',person.username,
      'avatar_key',person.avatar_key,'xp_total',person.xp_total,
      'current_streak',case when person.last_activity_date >= public.learning_day() - 1 then person.current_streak else 0 end,
      'longest_streak',person.longest_streak,'last_activity_date',person.last_activity_date,
      'created_at',person.created_at,'updated_at',person.updated_at),
    'guestImported',exists(select 1 from public.guest_progress_imports where user_id = owner));
end;
$$;

create function public.start_learning_lesson(p_lesson_id text) returns void
language plpgsql security definer set search_path = '' as $$
declare owner uuid := auth.uid();
begin
  if owner is null then raise exception 'auth_required'; end if;
  perform 1 from public.profiles where id = owner for update;
  perform public.assert_lesson_available(owner,p_lesson_id);
  insert into public.user_lesson_progress(user_id,lesson_id,status) values(owner,p_lesson_id,'in_progress')
    on conflict(user_id,lesson_id) do update set status = case when public.user_lesson_progress.status in ('completed','mastered')
      then public.user_lesson_progress.status else 'in_progress' end, updated_at = now();
end;
$$;

create function public.complete_learning_lesson(p_lesson_id text, p_answers jsonb, p_attempt_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare owner uuid := auth.uid(); q public.questions; answer jsonb; options jsonb; solution jsonb;
  correct integer := 0; total integer := 0; accuracy integer; earned integer; already_completed boolean;
  result jsonb; old_attempt public.lesson_attempts; target_unit_id text; next_id text; valid boolean;
begin
  if owner is null then raise exception 'auth_required'; end if;
  if p_attempt_id is null or char_length(p_attempt_id) not between 1 and 200 or jsonb_typeof(p_answers) is distinct from 'object'
    then raise exception 'answer_invalid'; end if;
  perform 1 from public.profiles where id = owner for update;
  if not found then raise exception 'profile_missing'; end if;
  select * into old_attempt from public.lesson_attempts where user_id = owner and attempt_key = p_attempt_id;
  if found then
    if old_attempt.lesson_id <> p_lesson_id or old_attempt.answers <> p_answers then raise exception 'attempt_conflict'; end if;
    select l.unit_id into target_unit_id from public.lessons l where l.id = p_lesson_id;
    return jsonb_build_object('snapshot',public.learning_snapshot(target_unit_id),'result',old_attempt.result);
  end if;
  perform public.assert_lesson_available(owner,p_lesson_id);
  select l.unit_id into target_unit_id from public.lessons l where l.id = p_lesson_id;
  for q in select * from public.questions where lesson_id = p_lesson_id order by order_index loop
    answer := p_answers -> q.id; options := q.content -> 'options'; solution := q.content -> 'correctAnswer'; valid := false;
    if q.type = 'content_card' then
      if answer is distinct from '"seen"'::jsonb then raise exception 'answer_incomplete'; end if;
      continue;
    end if;
    total := total + 1;
    if q.type in ('multiple_choice','true_false','fill_blank','who_am_i') then
      valid := jsonb_typeof(answer) = 'string' and exists(select 1 from jsonb_array_elements(options) o where o -> 'id' = answer);
    elsif q.type in ('ordering','multi_select') and jsonb_typeof(answer) = 'array' then
      select count(*) > 0 and count(*) = count(distinct value)
        and bool_and(exists(select 1 from jsonb_array_elements(options) o where o -> 'id' = a.value)) into valid
        from jsonb_array_elements(answer) a;
      if q.type = 'ordering' then valid := valid and jsonb_array_length(answer) = jsonb_array_length(options); end if;
    elsif q.type = 'matching' and jsonb_typeof(answer) = 'object' then
      select count(*) = jsonb_array_length(options) and count(*) = count(distinct value)
        and bool_and(exists(select 1 from jsonb_array_elements(options) o where o ->> 'id' = a.key)
          and exists(select 1 from jsonb_array_elements(q.content -> 'rightOptions') o where o -> 'id' = a.value)) into valid
        from jsonb_each(answer) a;
    end if;
    if valid is distinct from true then raise exception 'answer_invalid'; end if;
    if q.type = 'multi_select' then
      if jsonb_array_length(answer) = jsonb_array_length(solution) and answer @> solution and solution @> answer then correct := correct + 1; end if;
    elsif answer = solution then correct := correct + 1;
    end if;
  end loop;
  if total = 0 then raise exception 'content_unavailable'; end if;
  accuracy := round(correct::numeric / total * 100)::integer;
  select exists(select 1 from public.user_lesson_progress where user_id = owner and lesson_id = p_lesson_id
    and status in ('completed','mastered')) into already_completed;
  earned := case when already_completed then 0 else correct * 2 + 10 + case when correct = total then 5 else 0 end end;
  result := jsonb_build_object('attemptId',p_attempt_id,'lessonId',p_lesson_id,'correct',correct,'total',total,
    'accuracy',accuracy,'xpEarned',earned,'completedAt',now());
  insert into public.lesson_attempts(user_id,lesson_id,attempt_key,answers,result) values(owner,p_lesson_id,p_attempt_id,p_answers,result);
  insert into public.user_lesson_progress(user_id,lesson_id,status,score,accuracy,attempts,xp_earned,completed_at)
    values(owner,p_lesson_id,case when correct = total then 'mastered' else 'completed' end,correct,accuracy,1,earned,now())
    on conflict(user_id,lesson_id) do update set
      status = case when public.user_lesson_progress.status = 'mastered' or excluded.status = 'mastered' then 'mastered' else 'completed' end,
      score = greatest(public.user_lesson_progress.score,excluded.score), accuracy = greatest(public.user_lesson_progress.accuracy,excluded.accuracy),
      attempts = public.user_lesson_progress.attempts + 1, xp_earned = public.user_lesson_progress.xp_earned + earned,
      completed_at = coalesce(public.user_lesson_progress.completed_at,now()), updated_at = now();
  if earned > 0 then
    insert into public.xp_events(user_id,lesson_id,amount,reason) values(owner,p_lesson_id,earned,'lesson_completed');
    update public.profiles set xp_total = xp_total + earned where id = owner;
  end if;
  perform public.record_learning_activity(owner,1,earned);
  select l.id into next_id from public.lessons l where l.unit_id = target_unit_id and l.published
    and not exists(select 1 from public.user_lesson_progress p where p.user_id = owner and p.lesson_id = l.id and p.status in ('completed','mastered'))
    order by l.order_index limit 1;
  if next_id is not null then
    insert into public.user_lesson_progress(user_id,lesson_id,status) values(owner,next_id,'available') on conflict(user_id,lesson_id) do nothing;
  end if;
  return jsonb_build_object('snapshot',public.learning_snapshot(target_unit_id),'result',result);
end;
$$;

create function public.import_guest_progress(p_source_id text, p_completed_ids jsonb, p_xp integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare owner uuid := auth.uid(); source_owner uuid; ids jsonb; n integer; max_xp integer;
  remaining integer; award integer; imported_lesson_id text; lessons_added integer := 0; xp_added integer := 0;
begin
  if owner is null then raise exception 'auth_required'; end if;
  if p_source_id is null or char_length(p_source_id) not between 1 and 200 or jsonb_typeof(p_completed_ids) is distinct from 'array'
    or p_xp is null then raise exception 'guest_invalid'; end if;
  perform 1 from public.profiles where id = owner for update;
  if not found then raise exception 'profile_missing'; end if;
  if exists(select 1 from public.guest_progress_imports where user_id = owner) then return public.learning_snapshot(); end if;
  -- Serialize the same guest dataset across different accounts without exposing identity.
  perform pg_advisory_xact_lock(hashtextextended(p_source_id,0));
  select user_id into source_owner from public.guest_progress_imports where source_id = p_source_id;
  if found and source_owner <> owner then raise exception 'guest_already_imported'; end if;
  n := jsonb_array_length(p_completed_ids);
  select coalesce(jsonb_agg(id order by order_index),'[]'::jsonb) into ids from
    (select id,order_index from public.lessons where unit_id = 'conhecendo-a-biblia' and published order by order_index limit n) ordered;
  if n = 0 or ids <> p_completed_ids then raise exception 'guest_invalid'; end if;
  select coalesce(sum(10 + 2 * (select count(*) from public.questions q where q.lesson_id = l.id and q.type <> 'content_card') + 5),0)::integer
    into max_xp from public.lessons l where l.id in (select jsonb_array_elements_text(p_completed_ids));
  if p_xp < n * 10 or p_xp > max_xp then raise exception 'guest_invalid'; end if;
  remaining := p_xp - n * 10;
  for imported_lesson_id in select jsonb_array_elements_text(p_completed_ids) loop
    select 10 + least(remaining,2 * count(*)::integer + 5) into award from public.questions q where q.lesson_id = imported_lesson_id and q.type <> 'content_card';
    remaining := remaining - (award - 10);
    if not exists(select 1 from public.user_lesson_progress p where p.user_id = owner and p.lesson_id = imported_lesson_id and p.status in ('completed','mastered')) then
      insert into public.user_lesson_progress(user_id,lesson_id,status,xp_earned,completed_at)
        values(owner,imported_lesson_id,'completed',award,now()) on conflict(user_id,lesson_id) do update set
          status = 'completed',xp_earned = excluded.xp_earned,completed_at = now(),updated_at = now();
      insert into public.xp_events(user_id,lesson_id,amount,reason) values(owner,imported_lesson_id,award,'guest_import');
      lessons_added := lessons_added + 1; xp_added := xp_added + award;
    end if;
  end loop;
  insert into public.guest_progress_imports(user_id,source_id,snapshot) values(owner,p_source_id,jsonb_build_object('completedLessonIds',p_completed_ids,'xp',p_xp));
  update public.profiles set xp_total = xp_total + xp_added where id = owner;
  if lessons_added > 0 then perform public.record_learning_activity(owner,lessons_added,xp_added); end if;
  return public.learning_snapshot();
end;
$$;

revoke all on function public.learning_day(), public.record_learning_activity(uuid,integer,integer),
  public.assert_lesson_available(uuid,text), public.learning_snapshot(text), public.start_learning_lesson(text),
  public.complete_learning_lesson(text,jsonb,text), public.import_guest_progress(text,jsonb,integer) from public, anon, authenticated;
grant execute on function public.learning_snapshot(text), public.start_learning_lesson(text),
  public.complete_learning_lesson(text,jsonb,text), public.import_guest_progress(text,jsonb,integer) to authenticated;
commit;
