-- Additive upgrade. Historical curriculum, user progress and attempts are retained.
begin;
alter table public.questions drop constraint questions_type_check;
alter table public.questions add constraint questions_type_check check(type in ('multiple_choice','fill_blank','matching','ordering','multi_select','true_false','who_am_i','content_card','odd_one_out','fix_sentence','before_after','sequence','classify','cause_effect','quote_character','spot_the_error','story_summary'));
create or replace function public.complete_learning_lesson(p_lesson_id text, p_answers jsonb, p_attempt_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare owner uuid := auth.uid(); q public.questions; answer jsonb; options jsonb; solution jsonb;
  correct integer := 0; total integer := 0; accuracy integer; earned integer; already_completed boolean;
  result jsonb; old_attempt public.lesson_attempts; target_unit_id text; next_id text; valid boolean; current_revision boolean;
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
  current_revision := exists(select 1 from public.questions where lesson_id=p_lesson_id and id like '%-v2' and p_answers ? id);
  if (select count(*) from jsonb_object_keys(p_answers)) <> (select count(*) from public.questions where lesson_id=p_lesson_id and (case when current_revision then order_index<1000 else order_index>=1000 end)) then raise exception 'answer_invalid'; end if;
  for q in select * from public.questions where lesson_id = p_lesson_id and (case when current_revision then order_index<1000 else order_index>=1000 end) order by order_index loop
    answer := p_answers -> q.id; options := q.content -> 'options'; solution := q.content -> 'correctAnswer'; valid := false;
    if q.type = 'content_card' then
      if answer is distinct from '"seen"'::jsonb then raise exception 'answer_incomplete'; end if;
      continue;
    end if;
    total := total + 1;
    if q.type in ('multiple_choice','true_false','fill_blank','who_am_i','odd_one_out','before_after','sequence','cause_effect','quote_character','spot_the_error','story_summary') then
      valid := jsonb_typeof(answer) = 'string' and exists(select 1 from jsonb_array_elements(options) o where o -> 'id' = answer);
    elsif q.type in ('ordering','multi_select') and jsonb_typeof(answer) = 'array' then
      select count(*) > 0 and count(*) = count(distinct value)
        and bool_and(exists(select 1 from jsonb_array_elements(options) o where o -> 'id' = a.value)) into valid
        from jsonb_array_elements(answer) a;
      if q.type = 'ordering' then valid := valid and jsonb_array_length(answer) = jsonb_array_length(options); end if;
    elsif q.type = 'fix_sentence' and jsonb_typeof(answer) = 'object' then
      valid := (select count(*) from jsonb_object_keys(answer))=2
        and exists(select 1 from jsonb_array_elements(q.content->'fragments') f where f->'id'=answer->'fragment')
        and exists(select 1 from jsonb_array_elements(options) o where o->'id'=answer->'replacement');
    elsif q.type = 'classify' and jsonb_typeof(answer) = 'object' then
      select count(*) = jsonb_array_length(options)
        and bool_and(exists(select 1 from jsonb_array_elements(options) o where o->>'id'=a.key)
          and exists(select 1 from jsonb_array_elements(q.content->'categories') c where c->'id'=a.value)) into valid from jsonb_each(answer) a;
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

revoke all on function public.complete_learning_lesson(text,jsonb,text) from public,anon;
grant execute on function public.complete_learning_lesson(text,jsonb,text) to authenticated;
-- CURRENT_CURRICULUM
commit;
