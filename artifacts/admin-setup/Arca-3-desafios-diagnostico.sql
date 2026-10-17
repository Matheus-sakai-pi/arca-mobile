begin;

create table public.learning_diagnostics_config (
  singleton boolean primary key default true check(singleton),
  enabled_at timestamptz not null default now()
);
insert into public.learning_diagnostics_config(singleton) values(true);
alter table public.learning_diagnostics_config enable row level security;
revoke all on public.learning_diagnostics_config from public,anon,authenticated;
create trigger questions_diagnostic_revision before update on public.questions for each row execute function public.touch_updated_at();

create table public.learning_challenges (
  id uuid primary key default gen_random_uuid(),
  sender uuid not null references public.profiles(id) on delete cascade,
  recipient uuid not null references public.profiles(id) on delete cascade,
  request_key text not null check(char_length(request_key) between 8 and 100),
  questions jsonb not null,
  status text not null default 'pending' check(status in ('pending','accepted','declined','cancelled')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '7 days',
  check(sender<>recipient), unique(sender,request_key)
);
create index learning_challenges_recipient on public.learning_challenges(recipient,created_at desc);
create index learning_challenges_sender on public.learning_challenges(sender,created_at desc);
create table public.learning_challenge_results (
  challenge_id uuid not null references public.learning_challenges(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  answers jsonb not null, score integer not null check(score between 0 and 5),
  created_at timestamptz not null default now(), primary key(challenge_id,user_id)
);
alter table public.learning_challenges enable row level security;
alter table public.learning_challenge_results enable row level security;
revoke all on public.learning_challenges,public.learning_challenge_results from public,anon,authenticated;

create function public.learning_challenges() returns jsonb
language plpgsql security definer set search_path='' as $$
declare owner uuid:=auth.uid(); result jsonb;
begin
  if owner is null then raise exception 'auth_required'; end if;
  select coalesce(jsonb_agg(to_jsonb(item) order by item."createdAt" desc),'[]'::jsonb) into result from (
    select c.id,c.sender,c.recipient,
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

create function public.learning_challenge_create(p_friend uuid,p_key text) returns uuid
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
  -- Both participants must already have access to each selected lesson.
  select jsonb_agg(to_jsonb(q) order by q.id) into chosen from (
    select q.id,q.type,q.prompt,q.explanation,q.content from public.questions q
    join public.lessons l on l.id=q.lesson_id join public.units u on u.id=l.unit_id join public.courses c on c.id=u.course_id
    where q.order_index<1000 and q.type in ('multiple_choice','true_false','fill_blank','who_am_i','odd_one_out','before_after','sequence','cause_effect','quote_character','spot_the_error')
      and l.published and u.published and c.published
      and (l.order_index=0 and u.order_index=0 or exists(select 1 from public.user_lesson_progress where lesson_id=l.id and user_id=owner and status in ('completed','mastered'))
        and exists(select 1 from public.user_lesson_progress where lesson_id=l.id and user_id=p_friend and status in ('completed','mastered')))
    order by random() limit 5
  ) q;
  if chosen is null or jsonb_array_length(chosen)<>5 then raise exception 'challenge_content_missing'; end if;
  insert into public.learning_challenges(sender,recipient,request_key,questions) values(owner,p_friend,p_key,chosen) returning id into result;
  return result;
end; $$;

create function public.learning_challenge_action(p_id uuid,p_action text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare owner uuid:=auth.uid(); challenge public.learning_challenges;
begin
  if owner is null then raise exception 'auth_required'; end if;
  select * into challenge from public.learning_challenges where id=p_id and owner in(sender,recipient) for update;
  if not found then raise exception 'challenge_missing'; end if;
  if p_action is null or p_action not in ('accept','decline','cancel') then raise exception 'challenge_invalid'; end if;
  if challenge.expires_at<=now() then raise exception 'challenge_expired'; end if;
  if p_action='accept' and challenge.recipient=owner and challenge.status in ('pending','accepted') then
    update public.learning_challenges set status='accepted' where id=p_id;
  elsif p_action='decline' and challenge.recipient=owner and challenge.status in ('pending','declined') then
    update public.learning_challenges set status='declined' where id=p_id;
  elsif p_action='cancel' and challenge.sender=owner and challenge.status in ('pending','cancelled') then
    update public.learning_challenges set status='cancelled' where id=p_id;
  else raise exception 'challenge_not_allowed'; end if;
  return public.learning_challenges();
end; $$;

create function public.learning_challenge_play(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare owner uuid:=auth.uid(); challenge public.learning_challenges;
begin
  if owner is null then raise exception 'auth_required'; end if;
  select * into challenge from public.learning_challenges where id=p_id and owner in(sender,recipient);
  if not found then raise exception 'challenge_missing'; end if;
  if challenge.status<>'accepted' then raise exception 'challenge_not_accepted'; end if;
  if challenge.expires_at<=now() then raise exception 'challenge_expired'; end if;
  if exists(select 1 from public.learning_challenge_results where challenge_id=p_id and user_id=owner) then raise exception 'challenge_finished'; end if;
  -- Keep the solution and explanation private until the attempt is submitted.
  return jsonb_build_object('id',p_id,'owner',owner,'questions',(select jsonb_agg(jsonb_build_object('id',q->>'id','type',q->>'type','prompt',q->>'prompt','content',(q->'content')-'correctAnswer')) from jsonb_array_elements(challenge.questions) q));
end; $$;

create function public.learning_challenge_submit(p_id uuid,p_answers jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare owner uuid:=auth.uid(); challenge public.learning_challenges; previous public.learning_challenge_results; q jsonb; answer jsonb; score integer:=0;
begin
  if owner is null then raise exception 'auth_required'; end if;
  select * into challenge from public.learning_challenges where id=p_id and owner in(sender,recipient) for update;
  if not found then raise exception 'challenge_missing'; end if;
  select * into previous from public.learning_challenge_results where challenge_id=p_id and user_id=owner;
  if found then
    if previous.answers<>p_answers then raise exception 'challenge_conflict'; end if;
    return public.learning_challenges();
  end if;
  if challenge.status<>'accepted' then raise exception 'challenge_not_accepted'; end if;
  if challenge.expires_at<=now() then raise exception 'challenge_expired'; end if;
  if jsonb_typeof(p_answers) is distinct from 'object' then raise exception 'challenge_answer_invalid'; end if;
  if (select count(*) from jsonb_object_keys(p_answers))<>5 then raise exception 'challenge_answer_invalid'; end if;
  for q in select value from jsonb_array_elements(challenge.questions) loop
    answer:=p_answers->(q->>'id');
    if jsonb_typeof(answer) is distinct from 'string' or not exists(select 1 from jsonb_array_elements(q->'content'->'options') o where o->'id'=answer) then raise exception 'challenge_answer_invalid'; end if;
    if answer=q->'content'->'correctAnswer' then score:=score+1; end if;
  end loop;
  insert into public.learning_challenge_results(challenge_id,user_id,answers,score) values(p_id,owner,p_answers,score);
  return public.learning_challenges();
end; $$;

create table public.learning_study_sessions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  attempt_key text not null check(char_length(attempt_key) between 1 and 200),
  lesson_id text not null references public.lessons(id),
  started_at timestamptz not null default now(), last_seen_at timestamptz not null default now(),
  completed_at timestamptz, primary key(user_id,attempt_key)
);
create index study_sessions_lesson_date on public.learning_study_sessions(lesson_id,started_at);
alter table public.learning_study_sessions enable row level security;
revoke all on public.learning_study_sessions from public,anon,authenticated;

create function public.record_study_session(p_lesson text,p_attempt text) returns void
language plpgsql security definer set search_path='' as $$
declare owner uuid:=auth.uid(); existing public.learning_study_sessions;
begin
  if owner is null then raise exception 'auth_required'; end if;
  if p_attempt is null or char_length(p_attempt) not between 1 and 200 then raise exception 'study_invalid'; end if;
  perform pg_advisory_xact_lock(hashtextextended(owner::text,30));
  perform public.assert_lesson_available(owner,p_lesson);
  select * into existing from public.learning_study_sessions where user_id=owner and attempt_key=p_attempt;
  if found and existing.lesson_id<>p_lesson then raise exception 'study_conflict'; end if;
  if not found and (select count(*) from public.learning_study_sessions where user_id=owner and started_at>now()-interval '1 day')>=100 then raise exception 'study_limit'; end if;
  insert into public.learning_study_sessions(user_id,attempt_key,lesson_id,completed_at)
    values(owner,p_attempt,p_lesson,(select created_at from public.lesson_attempts where user_id=owner and attempt_key=p_attempt and lesson_id=p_lesson))
    on conflict(user_id,attempt_key) do update set last_seen_at=now();
end; $$;

create function public.finish_study_session() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  update public.learning_study_sessions set completed_at=new.created_at,last_seen_at=new.created_at
    where user_id=new.user_id and attempt_key=new.attempt_key and lesson_id=new.lesson_id;
  return new;
end; $$;
create trigger lesson_attempt_study_completion after insert on public.lesson_attempts for each row execute function public.finish_study_session();

create function public.arca_admin_diagnostics() returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  if not public.arca_is_admin() then raise exception 'admin_required'; end if;
  -- Existing first-answer receipts are graded against the current content. No raw answers leave this RPC.
  with question_metrics as (
    select q.id,q.prompt,l.title "lessonTitle",count(*)::int attempts,
      count(*) filter(where case when q.type='multi_select' then not((a.answers->q.id) @> (q.content->'correctAnswer') and (q.content->'correctAnswer') @> (a.answers->q.id)) else (a.answers->q.id)<>(q.content->'correctAnswer') end)::int errors
    from public.questions q join public.lessons l on l.id=q.lesson_id join public.lesson_attempts a on a.lesson_id=l.id and a.answers?q.id
    where q.order_index<1000 and q.type<>'content_card' and a.created_at>now()-interval '30 days'
      and a.created_at>=greatest(q.updated_at,(select enabled_at from public.learning_diagnostics_config))
    group by q.id,q.prompt,l.title having count(*)>=5
    order by count(*) filter(where case when q.type='multi_select' then not((a.answers->q.id) @> (q.content->'correctAnswer') and (q.content->'correctAnswer') @> (a.answers->q.id)) else (a.answers->q.id)<>(q.content->'correctAnswer') end)::numeric/count(*) desc,count(*) desc limit 20
  ), repeated as (
    select question_id id,max(lesson_title) "lessonTitle",max(question_snapshot->>'prompt') prompt,count(*)::int reports,
      count(*) filter(where status<>'resolved')::int pending from public.question_reports
    where created_at>now()-interval '30 days' group by question_id having count(*)>=2 order by count(*) desc limit 20
  ), sessions as (
    select l.id,l.title,count(*)::int started,count(*) filter(where s.completed_at is not null)::int completed,
      count(*) filter(where s.completed_at is null and s.last_seen_at<now()-interval '24 hours')::int unfinished
    from public.learning_study_sessions s join public.lessons l on l.id=s.lesson_id
    where s.started_at>now()-interval '30 days' group by l.id,l.title order by count(*) filter(where s.completed_at is null and s.last_seen_at<now()-interval '24 hours') desc,count(*) desc limit 20
  ) select jsonb_build_object('questions',coalesce((select jsonb_agg(to_jsonb(q)) from question_metrics q),'[]'::jsonb),
    'reports',coalesce((select jsonb_agg(to_jsonb(r)) from repeated r),'[]'::jsonb),
    'lessons',coalesce((select jsonb_agg(to_jsonb(s)) from sessions s),'[]'::jsonb),
    'trackingSince',(select enabled_at from public.learning_diagnostics_config)) into result;
  return result;
end; $$;

revoke all on function public.learning_challenges(),public.learning_challenge_create(uuid,text),public.learning_challenge_action(uuid,text),public.learning_challenge_play(uuid),public.learning_challenge_submit(uuid,jsonb),public.record_study_session(text,text),public.finish_study_session(),public.arca_admin_diagnostics() from public,anon,authenticated;
grant execute on function public.learning_challenges(),public.learning_challenge_create(uuid,text),public.learning_challenge_action(uuid,text),public.learning_challenge_play(uuid),public.learning_challenge_submit(uuid,jsonb),public.record_study_session(text,text),public.arca_admin_diagnostics() to authenticated;
notify pgrst,'reload schema';
commit;
