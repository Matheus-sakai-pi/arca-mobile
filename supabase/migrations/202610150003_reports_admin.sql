begin;

create table public.arca_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.arca_admins enable row level security;
revoke all on public.arca_admins from public,anon,authenticated;

create table public.question_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  request_key text not null check(char_length(request_key) between 8 and 100),
  lesson_id text not null,
  question_id text not null,
  lesson_title text not null,
  question_snapshot jsonb not null,
  reason text not null check(reason in ('answer','explanation','text','technical','other')),
  comment text not null default '' check(char_length(comment)<=1000),
  app_version text not null check(char_length(app_version) between 1 and 60),
  platform text not null check(platform in ('android','ios','web')),
  status text not null default 'new' check(status in ('new','reviewing','resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  unique(reporter_id,request_key)
);
create index question_reports_status_date on public.question_reports(status,created_at desc,id desc);
create index question_reports_owner_date on public.question_reports(reporter_id,created_at desc);
create index question_reports_question on public.question_reports(question_id);
alter table public.question_reports enable row level security;
revoke all on public.question_reports from public,anon,authenticated;

create function public.arca_is_admin() returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.arca_admins where user_id=auth.uid())
$$;

create function public.arca_admin_access() returns boolean
language sql stable security definer set search_path='' as $$ select public.arca_is_admin() $$;

create function public.submit_question_report(p_lesson text,p_question text,p_reason text,p_comment text,p_version text,p_platform text,p_request_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare owner uuid:=auth.uid(); report public.question_reports; question public.questions; title text; note text:=btrim(coalesce(p_comment,''));
begin
  if owner is null then raise exception 'auth_required'; end if;
  if p_reason is null or p_reason not in ('answer','explanation','text','technical','other')
    or char_length(note)>1000 or p_version is null or char_length(p_version) not between 1 and 60
    or p_platform is null or p_platform not in ('android','ios','web')
    or p_request_key is null or char_length(p_request_key) not between 8 and 100 then raise exception 'report_invalid'; end if;
  perform pg_advisory_xact_lock(hashtextextended('arca-reports:'||owner::text,0));
  select * into report from public.question_reports where reporter_id=owner and request_key=p_request_key;
  if found then
    if report.lesson_id is distinct from p_lesson or report.question_id is distinct from p_question
      or report.reason<>p_reason or report.comment<>note then raise exception 'report_request_conflict'; end if;
    return jsonb_build_object('id',report.id,'reporterId',owner,'received',true,'duplicate',true);
  end if;
  select q.* into question from public.questions q join public.lessons l on l.id=q.lesson_id
    join public.units u on u.id=l.unit_id join public.courses c on c.id=u.course_id
    where q.id=p_question and q.lesson_id=p_lesson and l.published and u.published and c.published;
  if not found then raise exception 'report_question_missing'; end if;
  select * into report from public.question_reports where reporter_id=owner and question_id=p_question
    and created_at>now()-interval '24 hours' order by created_at desc limit 1;
  if found then return jsonb_build_object('id',report.id,'reporterId',owner,'received',true,'duplicate',true); end if;
  if (select count(*) from public.question_reports where reporter_id=owner and created_at>now()-interval '24 hours')>=10
    then raise exception 'report_limit'; end if;
  select l.title into title from public.lessons l where l.id=p_lesson;
  insert into public.question_reports(reporter_id,request_key,lesson_id,question_id,lesson_title,question_snapshot,reason,comment,app_version,platform)
    values(owner,p_request_key,p_lesson,p_question,title,question.content||jsonb_build_object('id',question.id,'type',question.type,'prompt',question.prompt,'explanation',question.explanation),p_reason,note,p_version,p_platform)
    returning * into report;
  return jsonb_build_object('id',report.id,'reporterId',owner,'received',true,'duplicate',false);
end;
$$;

create function public.arca_admin_overview() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if not public.arca_is_admin() then raise exception 'admin_required'; end if;
  select jsonb_build_object(
    'users',(select count(*) from public.profiles),
    'newUsers7',(select count(*) from public.profiles where created_at>=now()-interval '7 days'),
    'students7',(select count(distinct user_id) from public.lesson_attempts where created_at>=now()-interval '7 days'),
    'lessons7',(select count(*) from public.lesson_attempts where created_at>=now()-interval '7 days'),
    'newReports',(select count(*) from public.question_reports where status='new'),
    'reviewingReports',(select count(*) from public.question_reports where status='reviewing'),
    'resolvedReports',(select count(*) from public.question_reports where status='resolved'),
    'reportedQuestions',(select count(distinct question_id) from public.question_reports where status<>'resolved'),
    'days',(select jsonb_agg(jsonb_build_object('day',d.activity_day::date,'lessons',coalesce(a.lessons,0),'students',coalesce(a.students,0)) order by d.activity_day)
      from generate_series((now() at time zone 'UTC')::date-13,(now() at time zone 'UTC')::date,interval '1 day') d(activity_day)
      left join (select (created_at at time zone 'UTC')::date as activity_day,count(*) lessons,count(distinct user_id) students
        from public.lesson_attempts where created_at>=(((now() at time zone 'UTC')::date-13)::timestamp at time zone 'UTC') group by 1) a on a.activity_day=d.activity_day::date)
  ) into result;
  return result;
end;
$$;

create function public.arca_admin_reports(p_status text default 'new',p_search text default '',p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if not public.arca_is_admin() then raise exception 'admin_required'; end if;
  if p_status is null or p_status not in ('all','new','reviewing','resolved') or p_search is null
    or char_length(p_search)>100 or p_offset is null or p_offset<0 or p_offset>50000 then raise exception 'report_filter_invalid'; end if;
  with filtered as (
    select r.* from public.question_reports r where (p_status='all' or r.status=p_status)
      and (p_search='' or position(lower(btrim(p_search)) in lower(r.lesson_title||' '||r.question_id||' '||(r.question_snapshot->>'prompt')))>0)
  ), paged as (select * from filtered order by created_at desc,id desc limit 50 offset p_offset)
  select jsonb_build_object('total',(select count(*) from filtered),'offset',p_offset,
    'items',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'lessonId',r.lesson_id,'questionId',r.question_id,'lessonTitle',r.lesson_title,
      'question',r.question_snapshot,'reason',r.reason,'comment',r.comment,'version',r.app_version,'platform',r.platform,'status',r.status,
      'createdAt',r.created_at,'updatedAt',r.updated_at,'reporter',coalesce(p.display_name,'Conta excluída'),
      'questionReports',(select count(*) from public.question_reports q where q.question_id=r.question_id)) order by r.created_at desc,r.id desc)
      from paged r left join public.profiles p on p.id=r.reporter_id),'[]'::jsonb)) into result;
  return result;
end;
$$;

create function public.arca_admin_report_status(p_id uuid,p_status text,p_expected timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare report public.question_reports;
begin
  if not public.arca_is_admin() then raise exception 'admin_required'; end if;
  if p_status is null or p_status not in ('new','reviewing','resolved') then raise exception 'report_invalid'; end if;
  select * into report from public.question_reports where id=p_id for update;
  if not found then raise exception 'report_missing'; end if;
  if p_expected is null or report.updated_at<>p_expected then raise exception 'report_conflict'; end if;
  update public.question_reports set status=p_status,reviewed_by=auth.uid(),updated_at=clock_timestamp() where id=p_id returning * into report;
  return jsonb_build_object('id',report.id,'status',report.status,'updatedAt',report.updated_at);
end;
$$;

revoke all on function public.arca_is_admin(),public.arca_admin_access(),public.submit_question_report(text,text,text,text,text,text,text),public.arca_admin_overview(),public.arca_admin_reports(text,text,integer),public.arca_admin_report_status(uuid,text,timestamptz) from public,anon,authenticated;
grant execute on function public.arca_admin_access(),public.submit_question_report(text,text,text,text,text,text,text),public.arca_admin_overview(),public.arca_admin_reports(text,text,integer),public.arca_admin_report_status(uuid,text,timestamptz) to authenticated;
notify pgrst,'reload schema';
commit;
