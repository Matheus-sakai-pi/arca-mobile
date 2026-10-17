-- Additive upgrade: accept both five-question and ten-question offline attempts.
-- Existing lesson identities, receipts, profiles, streaks and XP are retained.
begin;
alter table public.questions add column if not exists curriculum_revision integer not null default 2 check (curriculum_revision in (2,3));
-- COMPLETION_FUNCTION
revoke all on function public.complete_learning_lesson(text,jsonb,text) from public,anon;
grant execute on function public.complete_learning_lesson(text,jsonb,text) to authenticated;
-- CURRENT_CURRICULUM
commit;
