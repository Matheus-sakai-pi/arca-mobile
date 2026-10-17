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


insert into public.courses(id,title,description,published,order_index) values('biblia-basica','Conhecendo a Bíblia','Uma jornada pelos fundamentos bíblicos.',true,0) on conflict(id) do update set title = excluded.title, description = excluded.description, published = excluded.published;

insert into public.units(id,course_id,title,published,order_index) values('conhecendo-a-biblia','biblia-basica','Conhecendo a Bíblia',true,0) on conflict(id) do update set title = excluded.title,published = excluded.published,order_index = excluded.order_index;

insert into public.units(id,course_id,title,published,order_index) values('personagens-e-historias','biblia-basica','Personagens e Histórias Fundamentais',true,1) on conflict(id) do update set title = excluded.title,published = excluded.published,order_index = excluded.order_index;

-- Free existing order slots without deleting lessons or dependent progress.
update public.lessons set order_index = order_index + (select coalesce(max(order_index),0) + 1 from public.lessons) where unit_id in (select id from public.units where course_id='biblia-basica');

-- Retain original questions for offline attempts; hide them from the current curriculum.
update public.questions set order_index=order_index+1000 where order_index<1000 and id not like '%-v2';
update public.questions set order_index=order_index+100 where order_index<1000 and id like '%-v2';

insert into public.lessons(id,unit_id,title,description,published,order_index) values('o-que-e-a-biblia','conhecendo-a-biblia','O que é a Bíblia?','Uma coleção de livros e histórias.',true,0) on conflict(id) do update set unit_id = excluded.unit_id,title = excluded.title,description = excluded.description,published = excluded.published,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('biblia-1-v2','o-que-e-a-biblia','multiple_choice','O que é a Bíblia?','A Bíblia reúne diferentes livros, escritos em épocas e contextos distintos.','{"options":[{"id":"1","label":"Um único poema"},{"id":"2","label":"Uma coleção de livros"},{"id":"3","label":"Um mapa de cidades"}],"correctAnswer":"2"}'::jsonb,0) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('biblia-2-v2','o-que-e-a-biblia','fill_blank','Complete a frase de Gênesis 1:1.','Gênesis começa com a narrativa da criação dos céus e da terra.','{"sentence":"No princípio, Deus criou os {{blank}} e a terra.","options":[{"id":"1","label":"mares"},{"id":"2","label":"céus"},{"id":"3","label":"desertos"}],"correctAnswer":"2"}'::jsonb,1) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('biblia-3-v2','o-que-e-a-biblia','classify','Separe os livros nas duas partes da Bíblia.','Gênesis e Salmos estão no Antigo Testamento; Mateus e João, no Novo.','{"options":[{"id":"1","label":"Gênesis"},{"id":"2","label":"Mateus"},{"id":"3","label":"Salmos"},{"id":"4","label":"João"}],"correctAnswer":{"1":"1","2":"2","3":"1","4":"2"},"categories":[{"id":"1","label":"Antigo Testamento"},{"id":"2","label":"Novo Testamento"}]}'::jsonb,2) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('biblia-4-v2','o-que-e-a-biblia','sequence','Complete a divisão, da maior para a menor.','Livros são divididos em capítulos, e capítulos em versículos.','{"options":[{"id":"1","label":"Versículo"},{"id":"2","label":"Testamento"},{"id":"3","label":"Salmo"}],"correctAnswer":"1","sequence":["Livro","Capítulo",null]}'::jsonb,3) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('biblia-5-v2','o-que-e-a-biblia','spot_the_error','Qual trecho contém um erro?','Romanos é uma carta. Os Evangelhos são Mateus, Marcos, Lucas e João.','{"options":[{"id":"1","label":"A Bíblia reúne livros."},{"id":"2","label":"Salmos contém poemas."},{"id":"3","label":"Romanos é um Evangelho."}],"correctAnswer":"3"}'::jsonb,4) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.lessons(id,unit_id,title,description,published,order_index) values('antigo-e-novo-testamento','conhecendo-a-biblia','Antigo e Novo Testamento','Duas partes de uma grande história.',true,1) on conflict(id) do update set unit_id = excluded.unit_id,title = excluded.title,description = excluded.description,published = excluded.published,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('testamentos-1-v2','antigo-e-novo-testamento','true_false','Os Evangelhos fazem parte do Novo Testamento.','Mateus, Marcos, Lucas e João estão no Novo Testamento e narram a vida e os ensinamentos de Jesus.','{"options":[{"id":"true","label":"Verdadeiro"},{"id":"false","label":"Falso"}],"correctAnswer":"true"}'::jsonb,0) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('testamentos-2-v2','antigo-e-novo-testamento','multi_select','Quais destes livros são Evangelhos?','Mateus, Marcos, Lucas e João são Evangelhos. Romanos é uma carta.','{"options":[{"id":"1","label":"Mateus"},{"id":"2","label":"Romanos"},{"id":"3","label":"Marcos"},{"id":"4","label":"Lucas"},{"id":"5","label":"João"}],"correctAnswer":["1","3","4","5"]}'::jsonb,1) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('testamentos-3-v2','antigo-e-novo-testamento','odd_one_out','Qual livro não pertence ao grupo dos Evangelhos?','Romanos é uma carta; os outros três livros são Evangelhos.','{"options":[{"id":"1","label":"Mateus"},{"id":"2","label":"Marcos"},{"id":"3","label":"Lucas"},{"id":"4","label":"Romanos"}],"correctAnswer":"4"}'::jsonb,2) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('testamentos-4-v2','antigo-e-novo-testamento','matching','Associe cada livro ou grupo ao seu conteúdo.','Gênesis apresenta narrativas das origens; os Evangelhos narram a vida de Jesus; Romanos é uma carta.','{"options":[{"id":"1","label":"Gênesis"},{"id":"2","label":"Evangelhos"},{"id":"3","label":"Romanos"}],"rightOptions":[{"id":"1","label":"Vida e ensinamentos de Jesus"},{"id":"2","label":"Carta a uma comunidade cristã"},{"id":"3","label":"Narrativas das origens"}],"correctAnswer":{"1":"3","2":"1","3":"2"}}'::jsonb,3) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('testamentos-5-v2','antigo-e-novo-testamento','fix_sentence','Selecione o trecho incorreto e substitua-o.','Gênesis é o primeiro livro do Antigo Testamento.','{"options":[{"id":"1","label":"Antigo"},{"id":"2","label":"Terceiro"},{"id":"3","label":"Último"}],"correctAnswer":{"fragment":"2","replacement":"1"},"fragments":[{"id":"1","label":"Gênesis pertence ao"},{"id":"2","label":"Novo"},{"id":"3","label":"Testamento."}]}'::jsonb,4) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.lessons(id,unit_id,title,description,published,order_index) values('organizacao-da-biblia','conhecendo-a-biblia','Como a Bíblia é organizada','Livros, capítulos e versículos.',true,2) on conflict(id) do update set unit_id = excluded.unit_id,title = excluded.title,description = excluded.description,published = excluded.published,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('organizacao-1-v2','organizacao-da-biblia','ordering','Organize os três primeiros livros da Bíblia cristã.','Na organização da Bíblia cristã, Gênesis é seguido por Êxodo e Levítico.','{"options":[{"id":"1","label":"Levítico"},{"id":"2","label":"Gênesis"},{"id":"3","label":"Êxodo"}],"correctAnswer":["2","3","1"]}'::jsonb,0) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('organizacao-2-v2','organizacao-da-biblia','matching','Na referência João 3:16, associe cada parte.','João é o livro, 3 é o capítulo e 16 é o versículo.','{"options":[{"id":"1","label":"Livro"},{"id":"2","label":"Capítulo"},{"id":"3","label":"Versículo"}],"rightOptions":[{"id":"1","label":"16"},{"id":"2","label":"João"},{"id":"3","label":"3"}],"correctAnswer":{"1":"2","2":"3","3":"1"}}'::jsonb,1) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('organizacao-3-v2','organizacao-da-biblia','sequence','Qual livro completa a ordem dos Evangelhos?','Na ordem usual do Novo Testamento, os Evangelhos são Mateus, Marcos, Lucas e João.','{"options":[{"id":"1","label":"Romanos"},{"id":"2","label":"João"},{"id":"3","label":"Atos"}],"correctAnswer":"2","sequence":["Mateus","Marcos","Lucas",null]}'::jsonb,2) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('organizacao-4-v2','organizacao-da-biblia','spot_the_error','Encontre o erro nesta referência.','O capítulo é 3. O número depois dos dois-pontos é o versículo, 16.','{"options":[{"id":"1","label":"Em João 3:16, o livro é João."},{"id":"2","label":"O capítulo é 16."},{"id":"3","label":"O versículo é 16."}],"correctAnswer":"2"}'::jsonb,3) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('organizacao-5-v2','organizacao-da-biblia','odd_one_out','Qual elemento não é uma divisão de uma referência bíblica?','Uma referência identifica livro, capítulo e versículo; cidade não é uma dessas divisões.','{"options":[{"id":"1","label":"Livro"},{"id":"2","label":"Capítulo"},{"id":"3","label":"Versículo"},{"id":"4","label":"Cidade"}],"correctAnswer":"4"}'::jsonb,4) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.lessons(id,unit_id,title,description,published,order_index) values('revisao','conhecendo-a-biblia','Revisão','Reúna o que você aprendeu.',true,3) on conflict(id) do update set unit_id = excluded.unit_id,title = excluded.title,description = excluded.description,published = excluded.published,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('revisao-1-v2','revisao','multi_select','Selecione os Evangelhos nesta coleção de livros.','Mateus, Marcos, Lucas e João são os quatro Evangelhos do Novo Testamento.','{"options":[{"id":"1","label":"Romanos"},{"id":"2","label":"Lucas"},{"id":"3","label":"Mateus"},{"id":"4","label":"João"},{"id":"5","label":"Marcos"}],"correctAnswer":["2","3","4","5"]}'::jsonb,0) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('revisao-2-v2','revisao','fill_blank','Complete a referência bíblica.','O número depois dos dois-pontos indica o versículo: neste caso, 3.','{"sentence":"Em Gênesis 1:3, o versículo é o {{blank}}.","options":[{"id":"1","label":"1"},{"id":"2","label":"Gênesis"},{"id":"3","label":"3"}],"correctAnswer":"3"}'::jsonb,1) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('revisao-3-v2','revisao','before_after','Qual acontecimento vem primeiro em Gênesis?','O chamado de Abraão é narrado antes do nascimento de Isaque.','{"options":[{"id":"1","label":"Nascimento de Isaque"},{"id":"2","label":"Chamado de Abraão"}],"correctAnswer":"2"}'::jsonb,2) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('revisao-4-v2','revisao','fix_sentence','Selecione e corrija o nome nesta frase.','Gênesis apresenta Noé como o construtor da arca do dilúvio.','{"options":[{"id":"1","label":"Davi"},{"id":"2","label":"Noé"},{"id":"3","label":"Paulo"}],"correctAnswer":{"fragment":"1","replacement":"2"},"fragments":[{"id":"1","label":"Moisés"},{"id":"2","label":"construiu"},{"id":"3","label":"a arca do dilúvio."}]}'::jsonb,3) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('revisao-5-v2','revisao','who_am_i','Quem sou eu?','Na narrativa de Gênesis, Noé constrói a arca para abrigar sua família e animais.','{"clues":["Minha história aparece em Gênesis.","Preparei um abrigo para minha família e animais.","Construí uma arca antes do dilúvio."],"options":[{"id":"1","label":"Moisés"},{"id":"2","label":"Davi"},{"id":"3","label":"Noé"}],"correctAnswer":"3"}'::jsonb,4) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.lessons(id,unit_id,title,description,published,order_index) values('personagens-importantes','personagens-e-historias','Personagens importantes','Conheça pessoas das narrativas bíblicas.',true,0) on conflict(id) do update set unit_id = excluded.unit_id,title = excluded.title,description = excluded.description,published = excluded.published,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('personagens-1-v2','personagens-importantes','who_am_i','Quem sou eu?','Samuel narra a vitória de Davi sobre Golias e seu reinado; vários salmos são atribuídos a Davi.','{"clues":["Fui rei de Israel.","Derrotei Golias, segundo a narrativa de Samuel.","Meu nome aparece nos títulos de vários salmos."],"options":[{"id":"1","label":"Salomão"},{"id":"2","label":"Davi"},{"id":"3","label":"Noé"}],"correctAnswer":"2"}'::jsonb,0) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('personagens-2-v2','personagens-importantes','matching','Associe cada pessoa à sua história.','Gênesis apresenta Noé e a arca; Êxodo apresenta Moisés; os Evangelhos apresentam Maria como mãe de Jesus.','{"options":[{"id":"1","label":"Noé"},{"id":"2","label":"Moisés"},{"id":"3","label":"Maria"}],"rightOptions":[{"id":"1","label":"Mãe de Jesus"},{"id":"2","label":"Arca do dilúvio"},{"id":"3","label":"Saída do Egito"}],"correctAnswer":{"1":"2","2":"3","3":"1"}}'::jsonb,1) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('personagens-3-v2','personagens-importantes','ordering','Organize estes acontecimentos na narrativa de Gênesis.','Gênesis narra o chamado de Abraão antes dos nascimentos de Isaque, Jacó e José, nessa sequência.','{"options":[{"id":"1","label":"Nascimento de José"},{"id":"2","label":"Nascimento de Isaque"},{"id":"3","label":"Chamado de Abraão"},{"id":"4","label":"Nascimento de Jacó"}],"correctAnswer":["3","2","4","1"]}'::jsonb,2) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('personagens-4-v2','personagens-importantes','quote_character','Quem está relacionado a esta descrição?','Os Evangelhos apresentam Maria como a mãe de Jesus.','{"options":[{"id":"1","label":"Ester"},{"id":"2","label":"Maria"},{"id":"3","label":"Rute"}],"correctAnswer":"2","quote":"Foi a mãe de Jesus, segundo os Evangelhos.","source":"Descrição baseada em Lucas 1–2; não é uma citação literal."}'::jsonb,3) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('personagens-5-v2','personagens-importantes','before_after','Qual momento vem primeiro na história de Davi?','Samuel narra o encontro com Golias antes do reinado de Davi.','{"options":[{"id":"1","label":"Davi torna-se rei"},{"id":"2","label":"Davi enfrenta Golias"}],"correctAnswer":"2"}'::jsonb,4) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.lessons(id,unit_id,title,description,published,order_index) values('criacao-noe-e-abraao','personagens-e-historias','Dos começos à promessa','Criação, Noé e a família de Abraão.',true,1) on conflict(id) do update set unit_id = excluded.unit_id,title = excluded.title,description = excluded.description,published = excluded.published,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('origens-1-v2','criacao-noe-e-abraao','fill_blank','Complete a narrativa da criação.','Gênesis 1:5 chama a luz de dia e as trevas de noite.','{"sentence":"Em Gênesis, Deus chama a {{blank}} de dia.","options":[{"id":"1","label":"luz"},{"id":"2","label":"água"},{"id":"3","label":"terra"}],"correctAnswer":"1"}'::jsonb,0) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('origens-2-v2','criacao-noe-e-abraao','who_am_i','Quem sou eu?','Gênesis 6–9 apresenta Noé, sua família e a arca.','{"clues":["Minha história está em Gênesis.","Minha família e animais foram abrigados juntos.","Construí uma arca na narrativa do dilúvio."],"options":[{"id":"1","label":"Abraão"},{"id":"2","label":"Noé"},{"id":"3","label":"Moisés"}],"correctAnswer":"2"}'::jsonb,1) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('origens-3-v2','criacao-noe-e-abraao','ordering','Ordene estes acontecimentos na narrativa de Gênesis.','A narrativa passa pela criação, pelo dilúvio, pelo chamado de Abraão e pelo nascimento de Isaque.','{"options":[{"id":"1","label":"Chamado de Abraão"},{"id":"2","label":"Criação"},{"id":"3","label":"Nascimento de Isaque"},{"id":"4","label":"Dilúvio"}],"correctAnswer":["2","4","1","3"]}'::jsonb,2) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('origens-4-v2','criacao-noe-e-abraao','cause_effect','O que acontece como consequência?','Na narrativa de Gênesis, Noé prepara a arca para abrigar sua família e os animais.','{"options":[{"id":"1","label":"A família entra na arca"},{"id":"2","label":"Paulo escreve Romanos"},{"id":"3","label":"Davi torna-se rei"}],"correctAnswer":"1","event":"Noé prepara a arca antes do dilúvio.","relation":"effect"}'::jsonb,3) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('origens-conteudo-v2','criacao-noe-e-abraao','content_card','A família de Abraão','','{"body":"Gênesis narra o chamado de Abraão e o nascimento de Isaque, filho de Abraão e Sara. Isaque é pai de Jacó. José é um dos filhos de Jacó.","options":[],"correctAnswer":"seen"}'::jsonb,4) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('origens-5-v2','criacao-noe-e-abraao','story_summary','Qual resumo corresponde ao que você leu?','A narrativa apresenta as gerações Abraão, Isaque, Jacó e José.','{"options":[{"id":"1","label":"José é pai de Abraão e Isaque."},{"id":"2","label":"Abraão é pai de Isaque, Isaque de Jacó, e José é filho de Jacó."},{"id":"3","label":"Moisés e Paulo são filhos de Abraão."}],"correctAnswer":"2","contentId":"origens-conteudo-v2"}'::jsonb,5) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.lessons(id,unit_id,title,description,published,order_index) values('moises-e-davi','personagens-e-historias','Moisés e Davi','Libertação, coragem e liderança.',true,2) on conflict(id) do update set unit_id = excluded.unit_id,title = excluded.title,description = excluded.description,published = excluded.published,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('lideres-1-v2','moises-e-davi','odd_one_out','Qual nome não está no grupo de personagens do Antigo Testamento?','Paulo aparece no Novo Testamento; os outros três personagens aparecem no Antigo.','{"options":[{"id":"1","label":"Moisés"},{"id":"2","label":"Davi"},{"id":"3","label":"Noé"},{"id":"4","label":"Paulo"}],"correctAnswer":"4"}'::jsonb,0) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('lideres-2-v2','moises-e-davi','matching','Associe as pessoas às narrativas em que aparecem.','Moisés lidera a saída do Egito; Davi enfrenta Golias e depois se torna rei de Israel.','{"options":[{"id":"1","label":"Moisés"},{"id":"2","label":"Davi"},{"id":"3","label":"Golias"}],"rightOptions":[{"id":"1","label":"Rei de Israel"},{"id":"2","label":"Oponente enfrentado por Davi"},{"id":"3","label":"Líder na saída do Egito"}],"correctAnswer":{"1":"3","2":"1","3":"2"}}'::jsonb,1) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('lideres-3-v2','moises-e-davi','multi_select','Quais acontecimentos pertencem à história de Moisés?','Êxodo associa Moisés à saída do Egito e aos mandamentos no Sinai.','{"options":[{"id":"1","label":"Saída do Egito"},{"id":"2","label":"Construção da arca de Noé"},{"id":"3","label":"Entrega dos mandamentos no Sinai"},{"id":"4","label":"Viagens de Paulo"}],"correctAnswer":["1","3"]}'::jsonb,2) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('lideres-4-v2','moises-e-davi','quote_character','Quem está relacionado a esta ação?','Samuel narra Davi cuidando de ovelhas antes de enfrentar Golias e tornar-se rei.','{"options":[{"id":"1","label":"Davi"},{"id":"2","label":"Paulo"},{"id":"3","label":"Abraão"}],"correctAnswer":"1","quote":"Cuidava de ovelhas antes de enfrentar Golias.","source":"Descrição baseada em 1 Samuel 17; não é uma citação literal."}'::jsonb,3) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('lideres-5-v2','moises-e-davi','cause_effect','Qual acontecimento está relacionado como consequência?','Êxodo narra a resistência do faraó durante as pragas, antes de permitir a saída dos israelitas.','{"options":[{"id":"1","label":"A resistência continua durante as pragas"},{"id":"2","label":"Paulo viaja para Roma"},{"id":"3","label":"Noé constrói a arca"}],"correctAnswer":"1","event":"O faraó recusa o pedido para libertar os israelitas.","relation":"effect"}'::jsonb,4) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.lessons(id,unit_id,title,description,published,order_index) values('jesus-e-paulo','personagens-e-historias','Jesus e os primeiros cristãos','Evangelhos, viagens e cartas.',true,3) on conflict(id) do update set unit_id = excluded.unit_id,title = excluded.title,description = excluded.description,published = excluded.published,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('novo-conteudo-v2','jesus-e-paulo','content_card','Evangelhos, viagens e cartas','','{"body":"Os Evangelhos narram a vida e os ensinamentos de Jesus. Atos apresenta os primeiros cristãos e suas viagens, incluindo as de Paulo. Romanos é uma carta a uma comunidade cristã.","options":[],"correctAnswer":"seen"}'::jsonb,0) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('novo-1-v2','jesus-e-paulo','story_summary','Qual resumo corresponde à leitura?','Esses livros têm conteúdos e gêneros diferentes no Novo Testamento.','{"options":[{"id":"1","label":"Todos esses livros narram a criação."},{"id":"2","label":"Romanos é um Evangelho escrito por Moisés."},{"id":"3","label":"Os Evangelhos narram Jesus, Atos apresenta os primeiros cristãos e Romanos é uma carta."}],"correctAnswer":"3","contentId":"novo-conteudo-v2"}'::jsonb,1) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('novo-2-v2','jesus-e-paulo','fill_blank','Complete o nome do lugar.','Mateus 2 e Lucas 2 situam o nascimento de Jesus em Belém.','{"sentence":"Nos Evangelhos, Jesus é apresentado como nascido em {{blank}}.","options":[{"id":"1","label":"Roma"},{"id":"2","label":"Belém"},{"id":"3","label":"Atenas"}],"correctAnswer":"2"}'::jsonb,2) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('novo-3-v2','jesus-e-paulo','true_false','Paulo está ligado a viagens missionárias narradas em Atos.','Atos narra viagens de Paulo para anunciar a mensagem de Jesus.','{"options":[{"id":"true","label":"Verdadeiro"},{"id":"false","label":"Falso"}],"correctAnswer":"true"}'::jsonb,3) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('novo-4-v2','jesus-e-paulo','classify','Classifique os livros por Testamento.','Êxodo e Gênesis pertencem ao Antigo Testamento; Lucas e Romanos, ao Novo.','{"options":[{"id":"1","label":"Êxodo"},{"id":"2","label":"Lucas"},{"id":"3","label":"Romanos"},{"id":"4","label":"Gênesis"}],"correctAnswer":{"1":"1","2":"2","3":"2","4":"1"},"categories":[{"id":"1","label":"Antigo Testamento"},{"id":"2","label":"Novo Testamento"}]}'::jsonb,4) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('novo-5-v2','jesus-e-paulo','who_am_i','Quem sou eu?','Paulo aparece em Atos e seu nome está associado a várias cartas do Novo Testamento.','{"clues":["Minha história aparece em Atos.","Viajei entre diferentes comunidades.","Várias cartas do Novo Testamento levam meu nome."],"options":[{"id":"1","label":"Noé"},{"id":"2","label":"Davi"},{"id":"3","label":"Paulo"}],"correctAnswer":"3"}'::jsonb,5) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;


commit;
