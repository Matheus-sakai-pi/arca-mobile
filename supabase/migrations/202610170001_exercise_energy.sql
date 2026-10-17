begin;

create table public.battery_rules(singleton boolean primary key default true check(singleton), rules jsonb not null);
-- ENERGY_CONFIG_START
-- Generated from src/config/energy.ts. Do not edit these values here.
insert into public.battery_rules(singleton,rules) values(true,'{"version":2,"capacity":25,"exerciseCost":1,"refillSeconds":3456,"streakMilestones":[5,10],"streakBonusMin":5,"streakBonusMax":8,"perfectBonus":5,"bonusOverflow":false,"minimumDraftHours":72,"pollSeconds":30,"legacyCapacity":5,"legacyRefillSeconds":14400}'::jsonb);
-- ENERGY_CONFIG_END
alter table public.battery_rules enable row level security;
revoke all on public.battery_rules from public,anon,authenticated;
create function public.battery_config() returns jsonb language sql stable security definer set search_path='' as $$
  select rules from public.battery_rules where singleton
$$;

create table public.battery_wallets(
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  guest_hash text unique,
  balance integer not null check(balance>=0),
  refill_at timestamptz,
  created_at timestamptz not null default now(),
  check((user_id is null) <> (guest_hash is null))
);
create table public.battery_sessions(
  wallet_id uuid not null references public.battery_wallets(id) on delete cascade,
  attempt_id text not null check(char_length(attempt_id) between 1 and 200),
  lesson_id text not null references public.lessons(id) on delete cascade,
  queue text[] not null,
  answers jsonb not null default '{}',
  mastered text[] not null default '{}',
  streak integer not null default 0 check(streak>=0),
  turn integer not null default 0 check(turn>=0),
  draft jsonb,
  completed boolean not null default false,
  legacy boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key(wallet_id,attempt_id)
);
create index battery_resume on public.battery_sessions(wallet_id,lesson_id,updated_at desc) where not completed;
create table public.battery_events(
  wallet_id uuid not null,
  attempt_id text not null,
  turn integer not null,
  question_id text not null references public.questions(id),
  answer jsonb not null,
  receipt jsonb not null,
  created_at timestamptz not null default now(),
  primary key(wallet_id,attempt_id,turn),
  foreign key(wallet_id,attempt_id) references public.battery_sessions(wallet_id,attempt_id) on delete cascade
);
create table public.battery_rewards(
  wallet_id uuid not null references public.battery_wallets(id) on delete cascade,
  lesson_id text not null references public.lessons(id) on delete cascade,
  reward_key text not null,
  rolled integer not null,
  granted integer not null,
  primary key(wallet_id,lesson_id,reward_key)
);
-- Only server-known attempts from before this upgrade receive legacy treatment.
create table public.battery_legacy_attempts(
  user_id uuid not null references auth.users(id) on delete cascade,
  attempt_id text not null,
  lesson_id text not null references public.lessons(id) on delete cascade,
  primary key(user_id,attempt_id)
);
insert into public.battery_legacy_attempts(user_id,attempt_id,lesson_id)
  select user_id,attempt_key,lesson_id from public.learning_study_sessions where completed_at is null;
alter table public.battery_wallets enable row level security;
alter table public.battery_sessions enable row level security;
alter table public.battery_events enable row level security;
alter table public.battery_rewards enable row level security;
alter table public.battery_legacy_attempts enable row level security;
revoke all on public.battery_wallets,public.battery_sessions,public.battery_events,public.battery_rewards,public.battery_legacy_attempts from public,anon,authenticated;

-- Preserve the proportion of legacy account energy. No client balance/time is imported.
select public.energy_refresh(user_id) from public.learning_energy_wallets;
insert into public.battery_wallets(user_id,balance,refill_at)
select w.user_id, floor(w.balance::numeric*(r->>'capacity')::integer/(r->>'legacyCapacity')::integer)::integer,
  case when w.refill_at is null then null else now()+least((r->>'refillSeconds')::numeric,
    greatest(0,extract(epoch from w.refill_at-now()))*(r->>'refillSeconds')::numeric/(r->>'legacyRefillSeconds')::numeric)*interval '1 second' end
from public.learning_energy_wallets w cross join lateral public.battery_config() r;
alter table public.learning_energy_access add column battery_legacy_claimed boolean not null default false;

create function public.battery_grade(p_question text,p_answer jsonb) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare q public.questions; options jsonb; solution jsonb; valid boolean:=false;
begin
  select * into q from public.questions where id=p_question;
  if not found then raise exception 'content_unavailable'; end if;
  options:=q.content->'options'; solution:=q.content->'correctAnswer';
  if q.type='content_card' then
    if p_answer is distinct from '"seen"'::jsonb then raise exception 'answer_invalid'; end if;
    return true;
  elsif q.type in ('multiple_choice','true_false','fill_blank','who_am_i','odd_one_out','before_after','sequence','cause_effect','quote_character','spot_the_error','story_summary') then
    valid:=jsonb_typeof(p_answer)='string' and exists(select 1 from jsonb_array_elements(options) o where o->'id'=p_answer);
  elsif q.type in ('ordering','multi_select') and jsonb_typeof(p_answer)='array' then
    select count(*)>0 and count(*)=count(distinct value) and bool_and(exists(select 1 from jsonb_array_elements(options) o where o->'id'=a.value)) into valid from jsonb_array_elements(p_answer) a;
    if q.type='ordering' then valid:=valid and jsonb_array_length(p_answer)=jsonb_array_length(options); end if;
  elsif q.type='fix_sentence' and jsonb_typeof(p_answer)='object' then
    valid:=(select count(*) from jsonb_object_keys(p_answer))=2
      and exists(select 1 from jsonb_array_elements(q.content->'fragments') f where f->'id'=p_answer->'fragment')
      and exists(select 1 from jsonb_array_elements(options) o where o->'id'=p_answer->'replacement');
  elsif q.type='classify' and jsonb_typeof(p_answer)='object' then
    select count(*)=jsonb_array_length(options) and bool_and(exists(select 1 from jsonb_array_elements(options) o where o->>'id'=a.key)
      and exists(select 1 from jsonb_array_elements(q.content->'categories') c where c->'id'=a.value)) into valid from jsonb_each(p_answer) a;
  elsif q.type='matching' and jsonb_typeof(p_answer)='object' then
    select count(*)=jsonb_array_length(options) and count(*)=count(distinct value)
      and bool_and(exists(select 1 from jsonb_array_elements(options) o where o->>'id'=a.key)
        and exists(select 1 from jsonb_array_elements(q.content->'rightOptions') o where o->'id'=a.value)) into valid from jsonb_each(p_answer) a;
  end if;
  if valid is distinct from true then raise exception 'answer_invalid'; end if;
  if q.type='multi_select' then return jsonb_array_length(p_answer)=jsonb_array_length(solution) and p_answer @> solution and solution @> p_answer; end if;
  return p_answer=solution;
end;
$$;

create function public.battery_refresh(p_wallet uuid) returns void
language plpgsql security definer set search_path='' as $$
declare w public.battery_wallets; r jsonb:=public.battery_config(); ticks bigint; cap integer:=(r->>'capacity')::integer; seconds integer:=(r->>'refillSeconds')::integer;
begin
  select * into w from public.battery_wallets where id=p_wallet for update;
  if w.balance>=cap then update public.battery_wallets set refill_at=null where id=p_wallet and refill_at is not null;
  elsif w.refill_at is not null and w.refill_at<=now() then
    ticks:=least(cap,1+floor(extract(epoch from now()-w.refill_at)/seconds)::bigint);
    update public.battery_wallets set balance=least(cap,balance+ticks),refill_at=case when balance+ticks>=cap then null else refill_at+ticks*seconds*interval '1 second' end where id=p_wallet;
  end if;
end;
$$;
create function public.battery_reward(p_wallet uuid,p_lesson text,p_key text,p_min integer,p_max integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r jsonb:=public.battery_config(); w public.battery_wallets; rolled integer; granted integer;
begin
  if exists(select 1 from public.battery_rewards where wallet_id=p_wallet and lesson_id=p_lesson and reward_key=p_key) then return null; end if;
  select * into w from public.battery_wallets where id=p_wallet for update;
  rolled:=p_min+floor(random()*(p_max-p_min+1))::integer;
  granted:=case when (r->>'bonusOverflow')::boolean then rolled else least(rolled,greatest(0,(r->>'capacity')::integer-w.balance)) end;
  insert into public.battery_rewards values(p_wallet,p_lesson,p_key,rolled,granted);
  update public.battery_wallets set balance=balance+granted,refill_at=case when balance+granted>=(r->>'capacity')::integer then null else refill_at end where id=p_wallet;
  return jsonb_build_object('kind',p_key,'rolled',rolled,'amount',granted);
end;
$$;

create function public.learning_battery(p_action text default 'status',p_lesson text default null,p_attempt text default null,
  p_question text default null,p_answer jsonb default null,p_turn integer default null,p_guest text default null,p_resume jsonb default null) returns jsonb
language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare owner uuid:=auth.uid(); w public.battery_wallets; s public.battery_sessions; r jsonb:=public.battery_config();
  secret text; receipt jsonb; event public.battery_events; question public.questions; ids text[]; old_queue text[]; next_queue text[];
  correct boolean; first_answer boolean; charge integer; enabled boolean; bonuses jsonb:='[]'; bonus jsonb; result jsonb;
  question_index integer; remaining jsonb; seen_count integer; total integer; granted integer; legacy boolean:=false; pair record;
begin
  if p_action not in ('register','status','open','answer','finish') then raise exception 'battery_action_invalid'; end if;
  if owner is not null then
    perform 1 from public.profiles where id=owner for update;
    if not found then raise exception 'profile_missing'; end if;
    insert into public.battery_wallets(user_id,balance) values(owner,(r->>'capacity')::integer) on conflict(user_id) do nothing;
    select * into w from public.battery_wallets where user_id=owner for update;
  elsif p_action='register' and p_guest is null then
    secret:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
    insert into public.battery_wallets(guest_hash,balance) values(encode(sha256(convert_to(secret,'UTF8')),'hex'),(r->>'capacity')::integer) returning * into w;
  else
    if p_guest is null or p_guest !~ '^[a-f0-9]{64}$' then raise exception 'battery_guest_required'; end if;
    select * into w from public.battery_wallets where guest_hash=encode(sha256(convert_to(p_guest,'UTF8')),'hex') for update;
    if not found then raise exception 'battery_guest_required'; end if;
  end if;
  perform public.battery_refresh(w.id);
  enabled:=case when owner is null then public.learning_energy_public() else public.energy_applies(owner) end;
  if p_action in ('open','answer','finish') then
    if p_attempt is null or char_length(p_attempt) not between 1 and 200 then raise exception 'attempt_invalid'; end if;
    if owner is not null then perform public.assert_lesson_available(owner,p_lesson);
    elsif not exists(select 1 from public.lessons l join public.units u on u.id=l.unit_id join public.courses c on c.id=u.course_id where l.id=p_lesson and l.published and u.published and c.published) then raise exception 'content_unavailable'; end if;
    select coalesce(array_agg(id order by order_index),'{}') into ids from public.questions where lesson_id=p_lesson and order_index<1000;
    if cardinality(ids)=0 then raise exception 'content_unavailable'; end if;
    select * into s from public.battery_sessions where wallet_id=w.id and attempt_id=p_attempt for update;
    if found and s.lesson_id<>p_lesson then raise exception 'attempt_conflict'; end if;
    if p_action='open' and s.attempt_id is null then
      select * into s from public.battery_sessions where wallet_id=w.id and lesson_id=p_lesson and not completed order by updated_at desc limit 1 for update;
      if not found then
        -- One pre-upgrade lesson reservation remains valid, without new energy rewards.
        if owner is not null then
          delete from public.battery_legacy_attempts where user_id=owner and lesson_id=p_lesson and attempt_id=p_attempt returning true into legacy;
          if legacy then update public.learning_energy_access set battery_legacy_claimed=true where user_id=owner and lesson_id=p_lesson;
          else update public.learning_energy_access set battery_legacy_claimed=true where user_id=owner and lesson_id=p_lesson and not battery_legacy_claimed returning true into legacy;
          end if;
        end if;
        legacy:=coalesce(legacy,false);
        insert into public.battery_sessions(wallet_id,attempt_id,lesson_id,queue,legacy) values(w.id,p_attempt,p_lesson,ids,legacy) returning * into s;
        if owner is not null then
          insert into public.learning_energy_access(user_id,lesson_id,cost,battery_legacy_claimed) values(owner,p_lesson,0,true) on conflict do nothing;
          insert into public.user_lesson_progress(user_id,lesson_id,status) values(owner,p_lesson,'in_progress') on conflict(user_id,lesson_id) do nothing;
        end if;
      end if;
      -- Legacy answers are validated but neither charged again nor used to mint bonuses.
      if legacy and p_resume is not null and jsonb_typeof(p_resume)='object' then
        for pair in select q.id,q.type from public.questions q where q.lesson_id=p_lesson and q.order_index<1000 order by q.order_index loop
          exit when not (p_resume ? pair.id);
          correct:=public.battery_grade(pair.id,p_resume->pair.id);
          s.answers:=s.answers||jsonb_build_object(pair.id,p_resume->pair.id);
          if correct and pair.type<>'content_card' then s.mastered:=array_append(s.mastered,pair.id); end if;
          if pair.type<>'content_card' then s.streak:=case when correct then s.streak+1 else 0 end; end if;
          s.queue:=s.queue[2:]; if not correct then s.queue:=array_append(s.queue,pair.id); end if;
          s.turn:=s.turn+1;
        end loop;
        update public.battery_sessions set answers=s.answers,mastered=s.mastered,queue=s.queue,turn=s.turn,streak=s.streak where wallet_id=w.id and attempt_id=s.attempt_id;
      end if;
    end if;
    if s.attempt_id is null then raise exception 'battery_session_required'; end if;
    if p_action='answer' then
      if p_turn is null or p_turn<0 then raise exception 'answer_order_invalid'; end if;
      select * into event from public.battery_events where wallet_id=w.id and attempt_id=s.attempt_id and turn=p_turn;
      if found then
        if event.question_id<>p_question or event.answer is distinct from p_answer then raise exception 'answer_conflict'; end if;
        receipt:=event.receipt;
      else
        if s.completed or p_turn<>s.turn or s.queue[1] is distinct from p_question then raise exception 'answer_order_invalid'; end if;
        select * into question from public.questions where id=p_question and lesson_id=p_lesson and order_index<1000;
        if not found then raise exception 'content_unavailable'; end if;
        correct:=public.battery_grade(p_question,p_answer);
        first_answer:=not (s.answers ? p_question);
        charge:=case when enabled and not s.legacy and first_answer and question.type<>'content_card' then (r->>'exerciseCost')::integer else 0 end;
        select * into w from public.battery_wallets where id=w.id;
        if charge>w.balance then
          if owner is not null then
            insert into public.learning_energy_daily(user_id,day,blocked,last_blocked_at) values(owner,(now() at time zone 'UTC')::date,1,now())
              on conflict(user_id,day) do update set blocked=least(100000,public.learning_energy_daily.blocked+1),last_blocked_at=now();
          end if;
          return jsonb_build_object('version',r->'version','owner',coalesce(owner::text,'guest'),'available',true,'enabled',enabled,'balance',w.balance,'nextRefillAt',w.refill_at,'serverNow',now(),'rules',r,'allowed',false,'receipt',null,'session',jsonb_build_object('attemptId',s.attempt_id,'draft',s.draft,'nextQuestionId',s.queue[1],'nextTurn',s.turn,'remainingNew',cardinality(ids)-(select count(*) from jsonb_object_keys(s.answers)),'streak',s.streak));
        end if;
        update public.battery_wallets set balance=balance-charge,refill_at=case when balance-charge<(r->>'capacity')::integer then coalesce(refill_at,now()+(r->>'refillSeconds')::integer*interval '1 second') else null end where id=w.id;
        old_queue:=s.queue;
        next_queue:=coalesce(s.queue[2:],'{}'); if not correct then next_queue:=array_append(next_queue,p_question); end if;
        if first_answer then s.answers:=s.answers||jsonb_build_object(p_question,p_answer); end if;
        if correct and question.type<>'content_card' and not (p_question=any(s.mastered)) then s.mastered:=array_append(s.mastered,p_question); end if;
        if question.type<>'content_card' then s.streak:=case when correct then s.streak+1 else 0 end; end if;
        if enabled and not s.legacy and question.type<>'content_card' and correct and exists(select 1 from jsonb_array_elements_text(r->'streakMilestones') milestone where milestone::integer=s.streak) then
          bonus:=public.battery_reward(w.id,p_lesson,'streak-'||s.streak,(r->>'streakBonusMin')::integer,(r->>'streakBonusMax')::integer);
          if bonus is not null then bonuses:=bonuses||jsonb_build_array(bonus); end if;
        end if;
        select count(*) into total from public.questions where lesson_id=p_lesson and order_index<1000 and type<>'content_card';
        if enabled and not s.legacy and cardinality(s.mastered)=total and cardinality(next_queue)=0 and not exists(select 1 from public.questions q where q.lesson_id=p_lesson and q.order_index<1000 and q.type<>'content_card' and not public.battery_grade(q.id,s.answers->q.id)) then
          bonus:=public.battery_reward(w.id,p_lesson,'perfect',(r->>'perfectBonus')::integer,(r->>'perfectBonus')::integer);
          if bonus is not null then bonuses:=bonuses||jsonb_build_array(bonus); end if;
        end if;
        select array_position(ids,p_question)-1 into question_index;
        select coalesce(jsonb_agg(array_position(ids,qid)-1 order by position),'[]') into remaining from unnest(old_queue[2:]) with ordinality item(qid,position);
        s.draft:=jsonb_build_object('index',question_index,'answer',case when question.type='content_card' then null else p_answer end,'phase',case when question.type='content_card' then 'answering' else 'feedback' end,'answers',s.answers,'remaining',remaining,'mastered',to_jsonb(s.mastered),'turn',s.turn);
        receipt:=jsonb_build_object('key',s.attempt_id||':'||s.turn,'turn',s.turn,'correct',correct,'charged',charge,'bonuses',bonuses);
        insert into public.battery_events(wallet_id,attempt_id,turn,question_id,answer,receipt) values(w.id,s.attempt_id,s.turn,p_question,p_answer,receipt);
        update public.battery_sessions set queue=next_queue,answers=s.answers,mastered=s.mastered,streak=s.streak,turn=s.turn+1,draft=s.draft,updated_at=now() where wallet_id=w.id and attempt_id=s.attempt_id returning * into s;
      end if;
    elsif p_action='finish' then
      if cardinality(s.queue)<>0 then raise exception 'answer_incomplete'; end if;
      if owner is null then update public.battery_sessions set completed=true,updated_at=now() where wallet_id=w.id and attempt_id=s.attempt_id; end if;
    end if;
  end if;
  select * into w from public.battery_wallets where id=w.id;
  result:=jsonb_build_object('version',r->'version','owner',coalesce(owner::text,'guest'),'available',true,'enabled',enabled,'balance',w.balance,'nextRefillAt',w.refill_at,'serverNow',now(),'rules',r,'allowed',true,'receipt',receipt,'guestToken',secret);
  if s.attempt_id is not null then
    result:=result||jsonb_build_object('session',jsonb_build_object('attemptId',s.attempt_id,'draft',s.draft,'nextQuestionId',s.queue[1],'nextTurn',s.turn,'remainingNew',(select count(*) from public.questions q where q.lesson_id=p_lesson and q.order_index<1000 and q.type<>'content_card' and not (s.answers ? q.id)),'streak',s.streak,'legacy',s.legacy));
  end if;
  return result;
end;
$$;

-- Keep the previous grading/XP implementation private, behind a receipt guard.
alter function public.complete_learning_lesson(text,jsonb,text) rename to complete_learning_lesson_before_battery;
revoke all on function public.complete_learning_lesson_before_battery(text,jsonb,text) from public,anon,authenticated;
create function public.complete_learning_lesson(p_lesson_id text,p_answers jsonb,p_attempt_id text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare owner uuid:=auth.uid(); session public.battery_sessions; existing boolean; result jsonb;
begin
  if owner is null then raise exception 'auth_required'; end if;
  perform 1 from public.profiles where id=owner for update;
  select exists(select 1 from public.lesson_attempts where user_id=owner and attempt_key=p_attempt_id) into existing;
  if public.energy_applies(owner) and not existing then
    select s.* into session from public.battery_sessions s join public.battery_wallets w on w.id=s.wallet_id where w.user_id=owner and s.attempt_id=p_attempt_id and s.lesson_id=p_lesson_id for update of s;
    if not found then
      -- One already-paid, pre-upgrade pending attempt may finish without retroactive charges.
      delete from public.battery_legacy_attempts where user_id=owner and lesson_id=p_lesson_id and attempt_id=p_attempt_id;
      if found then update public.learning_energy_access set battery_legacy_claimed=true where user_id=owner and lesson_id=p_lesson_id;
      else
        update public.learning_energy_access set battery_legacy_claimed=true where user_id=owner and lesson_id=p_lesson_id and not battery_legacy_claimed;
        if not found then raise exception 'battery_receipts_required'; end if;
      end if;
    elsif cardinality(session.queue)<>0 or session.answers is distinct from p_answers then raise exception 'battery_receipts_required';
    end if;
  end if;
  result:=public.complete_learning_lesson_before_battery(p_lesson_id,p_answers,p_attempt_id);
  update public.battery_sessions s set completed=true,updated_at=now() from public.battery_wallets w where w.id=s.wallet_id and w.user_id=owner and s.attempt_id=p_attempt_id;
  return result;
end;
$$;
-- Old clients may still reserve access; new clients never spend energy at lesson entry.
-- Do not allow a new legacy reservation to bypass the per-exercise receipt guard.
create or replace function public.learning_energy_begin(p_lesson text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'auth_required'; end if;
  if public.energy_applies(auth.uid()) then raise exception 'battery_app_update_required'; end if;
  perform public.assert_lesson_available(auth.uid(),p_lesson);
  insert into public.learning_energy_access(user_id,lesson_id,cost,battery_legacy_claimed) values(auth.uid(),p_lesson,0,true) on conflict do nothing;
  return public.learning_energy_status(p_lesson)||jsonb_build_object('allowed',true);
end;
$$;

revoke all on function public.battery_config(),public.battery_grade(text,jsonb),public.battery_refresh(uuid),public.battery_reward(uuid,text,text,integer,integer),public.learning_battery(text,text,text,text,jsonb,integer,text,jsonb),public.complete_learning_lesson(text,jsonb,text) from public,anon,authenticated;
grant execute on function public.learning_battery(text,text,text,text,jsonb,integer,text,jsonb) to anon,authenticated;
grant execute on function public.complete_learning_lesson(text,jsonb,text) to authenticated;
update public.learning_energy_config set enabled=true,rollout=100,updated_at=clock_timestamp(),updated_by=null where singleton;
commit;
