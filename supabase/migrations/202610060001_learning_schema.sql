begin;

-- Extend the existing identity table rather than replacing accounts/profiles.
alter table public.profiles rename column xp to xp_total;
alter table public.profiles add column avatar_key text not null default 'learner';
alter table public.profiles add column updated_at timestamptz not null default now();

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end;
$$;
create trigger profiles_updated_at before update on public.profiles
for each row execute function public.touch_updated_at();

create table public.courses (
  id text primary key, title text not null, description text not null default '',
  published boolean not null default false, order_index integer not null default 0 check (order_index >= 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.units (
  id text primary key, course_id text not null references public.courses(id) on delete cascade,
  title text not null, published boolean not null default false,
  order_index integer not null check (order_index >= 0), unique(course_id, order_index),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.lessons (
  id text primary key, unit_id text not null references public.units(id) on delete cascade,
  title text not null, description text not null default '', published boolean not null default false,
  order_index integer not null check (order_index >= 0), unique(unit_id, order_index),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.questions (
  id text primary key, lesson_id text not null references public.lessons(id) on delete cascade,
  type text not null check (type in ('multiple_choice','fill_blank','matching','ordering','multi_select','true_false','who_am_i','content_card')),
  prompt text not null, content jsonb not null check (jsonb_typeof(content) = 'object'),
  explanation text not null default '', order_index integer not null check (order_index >= 0),
  unique(lesson_id, order_index),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.user_lesson_progress (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id text not null references public.lessons(id),
  status text not null check (status in ('available','in_progress','completed','mastered')),
  score integer check (score >= 0), accuracy integer check (accuracy between 0 and 100),
  attempts integer not null default 0 check (attempts >= 0), xp_earned integer not null default 0 check (xp_earned >= 0),
  completed_at timestamptz, updated_at timestamptz not null default now(), unique(user_id, lesson_id)
);
create table public.lesson_attempts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id text not null references public.lessons(id), attempt_key text not null check (char_length(attempt_key) between 1 and 200),
  answers jsonb not null check (jsonb_typeof(answers) = 'object'), result jsonb not null,
  created_at timestamptz not null default now(), unique(user_id, attempt_key)
);
create table public.xp_events (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id text not null references public.lessons(id), amount integer not null check (amount > 0),
  reason text not null check (reason in ('lesson_completed','guest_import')),
  created_at timestamptz not null default now(), unique(user_id, lesson_id)
);
create table public.user_daily_activity (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  activity_date date not null, lessons_completed integer not null default 0 check (lessons_completed >= 0),
  xp_earned integer not null default 0 check (xp_earned >= 0), unique(user_id, activity_date)
);
create table public.guest_progress_imports (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  source_id text not null unique check (char_length(source_id) between 1 and 200),
  snapshot jsonb not null, created_at timestamptz not null default now()
);

create index lessons_unit_order on public.lessons(unit_id, order_index);
create index questions_lesson_order on public.questions(lesson_id, order_index);
create index attempts_user_created on public.lesson_attempts(user_id, created_at desc);
create index activity_user_date on public.user_daily_activity(user_id, activity_date desc);

alter table public.courses enable row level security;
alter table public.units enable row level security;
alter table public.lessons enable row level security;
alter table public.questions enable row level security;
alter table public.user_lesson_progress enable row level security;
alter table public.lesson_attempts enable row level security;
alter table public.xp_events enable row level security;
alter table public.user_daily_activity enable row level security;
alter table public.guest_progress_imports enable row level security;

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (username, display_name, avatar_key, avatar_url) on public.profiles to authenticated;
revoke all on public.courses, public.units, public.lessons, public.questions,
  public.user_lesson_progress, public.lesson_attempts, public.xp_events,
  public.user_daily_activity, public.guest_progress_imports from anon, authenticated;
grant select on public.courses, public.units, public.lessons, public.questions to anon, authenticated;
grant select on public.user_lesson_progress, public.lesson_attempts, public.xp_events,
  public.user_daily_activity, public.guest_progress_imports to authenticated;

create policy "Published courses" on public.courses for select to anon, authenticated using (published);
create policy "Published units" on public.units for select to anon, authenticated
using (published and exists(select 1 from public.courses c where c.id = course_id and c.published));
create policy "Published lessons" on public.lessons for select to anon, authenticated
using (published and exists(select 1 from public.units u where u.id = unit_id and u.published));
create policy "Published questions" on public.questions for select to anon, authenticated
using (exists(select 1 from public.lessons l where l.id = lesson_id and l.published));
create policy "Own lesson progress" on public.user_lesson_progress for select to authenticated using ((select auth.uid()) = user_id);
create policy "Own attempts" on public.lesson_attempts for select to authenticated using ((select auth.uid()) = user_id);
create policy "Own XP events" on public.xp_events for select to authenticated using ((select auth.uid()) = user_id);
create policy "Own daily activity" on public.user_daily_activity for select to authenticated using ((select auth.uid()) = user_id);
create policy "Own import receipt" on public.guest_progress_imports for select to authenticated using ((select auth.uid()) = user_id);

-- Client writes use narrowly scoped RPCs: direct updates must not forge XP/streak/results.
revoke all on function public.touch_updated_at() from public, anon, authenticated;
commit;
