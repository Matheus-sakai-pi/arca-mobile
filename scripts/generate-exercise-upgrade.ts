import { readFile, writeFile } from 'node:fs/promises';

// Carry the existing transactional reward implementation forward without changing
// idempotency, RLS, XP, streak or import functions in the original migrations.
const original=await readFile(new URL('../supabase/migrations/202610060002_learning_functions.sql',import.meta.url),'utf8');
const start=original.indexOf('create function public.complete_learning_lesson(');
const end=original.indexOf('create function public.import_guest_progress(',start);
if(start<0 || end<0) throw new Error('Original completion function not found.');
let completion=original.slice(start,end).replace('create function','create or replace function');
completion=completion.replace('next_id text; valid boolean;','next_id text; valid boolean; current_revision boolean;');
completion=completion.replace('  for q in select * from public.questions where lesson_id = p_lesson_id order by order_index loop',`  current_revision := exists(select 1 from public.questions where lesson_id=p_lesson_id and id like '%-v2' and p_answers ? id);
  if (select count(*) from jsonb_object_keys(p_answers)) <> (select count(*) from public.questions where lesson_id=p_lesson_id and (case when current_revision then order_index<1000 else order_index>=1000 end)) then raise exception 'answer_invalid'; end if;
  for q in select * from public.questions where lesson_id = p_lesson_id and (case when current_revision then order_index<1000 else order_index>=1000 end) order by order_index loop`);
completion=completion.replace("('multiple_choice','true_false','fill_blank','who_am_i')","('multiple_choice','true_false','fill_blank','who_am_i','odd_one_out','before_after','sequence','cause_effect','quote_character','spot_the_error','story_summary')");
completion=completion.replace("    elsif q.type = 'matching' and jsonb_typeof(answer) = 'object' then",`    elsif q.type = 'fix_sentence' and jsonb_typeof(answer) = 'object' then
      valid := (select count(*) from jsonb_object_keys(answer))=2
        and exists(select 1 from jsonb_array_elements(q.content->'fragments') f where f->'id'=answer->'fragment')
        and exists(select 1 from jsonb_array_elements(options) o where o->'id'=answer->'replacement');
    elsif q.type = 'classify' and jsonb_typeof(answer) = 'object' then
      select count(*) = jsonb_array_length(options)
        and bool_and(exists(select 1 from jsonb_array_elements(options) o where o->>'id'=a.key)
          and exists(select 1 from jsonb_array_elements(q.content->'categories') c where c->'id'=a.value)) into valid from jsonb_each(answer) a;
    elsif q.type = 'matching' and jsonb_typeof(answer) = 'object' then`);
const types="'multiple_choice','fill_blank','matching','ordering','multi_select','true_false','who_am_i','content_card','odd_one_out','fix_sentence','before_after','sequence','classify','cause_effect','quote_character','spot_the_error','story_summary'";
const journey=await readFile(new URL('../supabase/templates/journey-functions.sql',import.meta.url),'utf8');
const importFunction=journey.slice(journey.indexOf('create or replace function public.import_guest_progress('),journey.indexOf('revoke all on function public.assert_lesson_available'))
  .replaceAll("q.type<>'content_card'","q.type<>'content_card' and q.order_index<1000");
const template=`-- Additive upgrade. Historical curriculum, user progress and attempts are retained.
begin;
alter table public.questions drop constraint questions_type_check;
alter table public.questions add constraint questions_type_check check(type in (${types}));
${completion}
${importFunction}
revoke all on function public.complete_learning_lesson(text,jsonb,text) from public,anon;
grant execute on function public.complete_learning_lesson(text,jsonb,text) to authenticated;
-- CURRENT_CURRICULUM
commit;
`;
await writeFile(new URL('../supabase/templates/varied-exercises.sql',import.meta.url),template);
