begin;

alter table public.learning_challenge_results drop constraint if exists learning_challenge_results_score_check;
alter table public.learning_challenge_results add constraint learning_challenge_results_score_check check(score between 0 and 10);
alter table public.learning_challenges drop constraint if exists learning_challenges_question_count;
alter table public.learning_challenges add constraint learning_challenges_question_count check(jsonb_typeof(questions)='array' and jsonb_array_length(questions) in (5,10));

create or replace function public.learning_challenges() returns jsonb
language plpgsql security definer set search_path='' as $$
declare owner uuid:=auth.uid(); result jsonb;
begin
  if owner is null then raise exception 'auth_required'; end if;
  select coalesce(jsonb_agg(to_jsonb(item) order by item."createdAt" desc),'[]'::jsonb) into result from (
    select c.id,c.sender,c.recipient,jsonb_array_length(c.questions) total,
      case when c.expires_at<=now() and (mine.score is null or theirs.score is null) and c.status in ('pending','accepted') then 'expired' else c.status end status,
      c.created_at "createdAt",c.expires_at "expiresAt", p.display_name "friendName",p.avatar_key "avatarKey",
      mine.score "myScore",case when mine.score is not null and theirs.score is not null then theirs.score end "theirScore",
      theirs.score is not null "friendFinished"
    from public.learning_challenges c join public.profiles p on p.id=case when c.sender=owner then c.recipient else c.sender end
    left join public.learning_challenge_results mine on mine.challenge_id=c.id and mine.user_id=owner
    left join public.learning_challenge_results theirs on theirs.challenge_id=c.id and theirs.user_id=p.id
    where owner in(c.sender,c.recipient) order by c.created_at desc,c.id limit 100
  ) item;
  return jsonb_build_object('owner',owner,'items',result);
end; $$;

create or replace function public.learning_challenge_create_ten(p_friend uuid,p_key text) returns uuid
language plpgsql security definer set search_path='' as $$
declare owner uuid:=auth.uid(); existing public.learning_challenges; chosen jsonb; result uuid;
begin
  if owner is null then raise exception 'auth_required'; end if;
  if p_key is null or char_length(p_key) not between 8 and 100 or p_friend is null or p_friend=owner then raise exception 'challenge_invalid'; end if;
  perform pg_advisory_xact_lock(hashtextextended(owner::text,29));
  perform pg_advisory_xact_lock(hashtextextended(p_friend::text,27));
  perform pg_advisory_xact_lock(hashtextextended(least(owner,p_friend)::text||':'||greatest(owner,p_friend)::text,28));
  select * into existing from public.learning_challenges where sender=owner and request_key=p_key;
  if found then
    if existing.recipient<>p_friend then raise exception 'challenge_conflict'; end if;
    return existing.id;
  end if;
  if not exists(select 1 from public.learning_friendships where person_a=least(owner,p_friend) and person_b=greatest(owner,p_friend) and status='accepted') then raise exception 'challenge_friend_required'; end if;
  if (select count(*) from public.learning_challenges where sender=owner and created_at>now()-interval '1 day')>=10
    or (select count(*) from public.learning_challenges where recipient=p_friend and status in ('pending','accepted') and expires_at>now()
      and (select count(*) from public.learning_challenge_results r where r.challenge_id=learning_challenges.id)<2)>=20 then raise exception 'challenge_limit'; end if;
  if exists(select 1 from public.learning_challenges where least(sender,recipient)=least(owner,p_friend) and greatest(sender,recipient)=greatest(owner,p_friend) and status in ('pending','accepted') and expires_at>now()
    and (select count(*) from public.learning_challenge_results r where r.challenge_id=learning_challenges.id)<2) then raise exception 'challenge_already_open'; end if;
  -- Use the existing formats so that the first lesson already supplies ten questions.
  -- Reading-dependent summaries are excluded rather than shown without their context.
  select jsonb_agg(to_jsonb(q) order by q.id) into chosen from (
    select q.id,q.type,q.prompt,q.explanation,q.content from public.questions q
    join public.lessons l on l.id=q.lesson_id join public.units u on u.id=l.unit_id join public.courses c on c.id=u.course_id
    where q.order_index<1000 and q.type not in ('content_card','story_summary')
      and l.published and u.published and c.published
      and (l.order_index=0 and u.order_index=0 or exists(select 1 from public.user_lesson_progress where lesson_id=l.id and user_id=owner and status in ('completed','mastered'))
        and exists(select 1 from public.user_lesson_progress where lesson_id=l.id and user_id=p_friend and status in ('completed','mastered')))
    order by random() limit 10
  ) q;
  if chosen is null or jsonb_array_length(chosen)<>10 then raise exception 'challenge_content_missing'; end if;
  insert into public.learning_challenges(sender,recipient,request_key,questions) values(owner,p_friend,p_key,chosen) returning id into result;
  return result;
end; $$;

create or replace function public.learning_challenge_create(p_friend uuid,p_key text) returns uuid
language sql security definer set search_path='' as $$
  select public.learning_challenge_create_ten(p_friend,p_key);
$$;

create or replace function public.learning_challenge_submit(p_id uuid,p_answers jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare owner uuid:=auth.uid(); challenge public.learning_challenges; previous public.learning_challenge_results;
  q jsonb; answer jsonb; options jsonb; solution jsonb; kind text; valid boolean; score integer:=0; total integer;
begin
  if owner is null then raise exception 'auth_required'; end if;
  select * into challenge from public.learning_challenges where id=p_id and owner in(sender,recipient) for update;
  if not found then raise exception 'challenge_missing'; end if;
  select * into previous from public.learning_challenge_results where challenge_id=p_id and user_id=owner;
  if found then
    if previous.answers is distinct from p_answers then raise exception 'challenge_conflict'; end if;
    return public.learning_challenges();
  end if;
  if challenge.status<>'accepted' then raise exception 'challenge_not_accepted'; end if;
  if challenge.expires_at<=now() then raise exception 'challenge_expired'; end if;
  if jsonb_typeof(p_answers) is distinct from 'object' then raise exception 'challenge_answer_invalid'; end if;
  total:=jsonb_array_length(challenge.questions);
  if total not in (5,10) or (select count(*) from jsonb_object_keys(p_answers))<>total then raise exception 'challenge_answer_invalid'; end if;
  for q in select value from jsonb_array_elements(challenge.questions) loop
    answer:=p_answers->(q->>'id'); options:=q->'content'->'options'; solution:=q->'content'->'correctAnswer'; kind:=q->>'type'; valid:=false;
    if kind in ('multiple_choice','true_false','fill_blank','who_am_i','odd_one_out','before_after','sequence','cause_effect','quote_character','spot_the_error') then
      valid:=jsonb_typeof(answer)='string' and exists(select 1 from jsonb_array_elements(options) o where o->'id'=answer);
    elsif kind in ('ordering','multi_select') and jsonb_typeof(answer)='array' then
      select count(*)>0 and count(*)=count(distinct value)
        and bool_and(exists(select 1 from jsonb_array_elements(options) o where o->'id'=a.value)) into valid from jsonb_array_elements(answer) a;
      if kind='ordering' then valid:=valid and jsonb_array_length(answer)=jsonb_array_length(options); end if;
    elsif kind='fix_sentence' and jsonb_typeof(answer)='object' then
      valid:=(select count(*) from jsonb_object_keys(answer))=2
        and exists(select 1 from jsonb_array_elements(q->'content'->'fragments') f where f->'id'=answer->'fragment')
        and exists(select 1 from jsonb_array_elements(options) o where o->'id'=answer->'replacement');
    elsif kind='classify' and jsonb_typeof(answer)='object' then
      select count(*)=jsonb_array_length(options) and bool_and(
        exists(select 1 from jsonb_array_elements(options) o where o->>'id'=a.key)
        and exists(select 1 from jsonb_array_elements(q->'content'->'categories') c where c->'id'=a.value)) into valid from jsonb_each(answer) a;
    elsif kind='matching' and jsonb_typeof(answer)='object' then
      select count(*)=jsonb_array_length(options) and count(*)=count(distinct value) and bool_and(
        exists(select 1 from jsonb_array_elements(options) o where o->>'id'=a.key)
        and exists(select 1 from jsonb_array_elements(q->'content'->'rightOptions') o where o->'id'=a.value)) into valid from jsonb_each(answer) a;
    end if;
    if valid is distinct from true then raise exception 'challenge_answer_invalid'; end if;
    if kind='multi_select' then
      if jsonb_array_length(answer)=jsonb_array_length(solution) and answer @> solution and solution @> answer then score:=score+1; end if;
    elsif answer=solution then score:=score+1;
    end if;
  end loop;
  insert into public.learning_challenge_results(challenge_id,user_id,answers,score) values(p_id,owner,p_answers,score);
  return public.learning_challenges();
end; $$;

revoke all on function public.learning_challenges(),public.learning_challenge_create(uuid,text),public.learning_challenge_create_ten(uuid,text),public.learning_challenge_submit(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.learning_challenges(),public.learning_challenge_create(uuid,text),public.learning_challenge_create_ten(uuid,text),public.learning_challenge_submit(uuid,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
