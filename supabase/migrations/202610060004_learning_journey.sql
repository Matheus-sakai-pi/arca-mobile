-- Generated from src/data/lessons.ts. Run with the SQL Editor or Supabase CLI.
begin;

insert into public.courses(id,title,description,published,order_index) values('biblia-basica','Conhecendo a Bíblia','Uma jornada pelos fundamentos bíblicos.',true,0) on conflict(id) do update set title = excluded.title, description = excluded.description, published = excluded.published;

insert into public.units(id,course_id,title,published,order_index) values('conhecendo-a-biblia','biblia-basica','Conhecendo a Bíblia',true,0) on conflict(id) do update set title = excluded.title,published = excluded.published,order_index = excluded.order_index;

insert into public.units(id,course_id,title,published,order_index) values('personagens-e-historias','biblia-basica','Personagens e Histórias Fundamentais',true,1) on conflict(id) do update set title = excluded.title,published = excluded.published,order_index = excluded.order_index;

-- Free existing order slots without deleting lessons or dependent progress.
update public.lessons set order_index = order_index + (select coalesce(max(order_index),0) + 1 from public.lessons) where unit_id in (select id from public.units where course_id='biblia-basica');

insert into public.lessons(id,unit_id,title,description,published,order_index) values('o-que-e-a-biblia','conhecendo-a-biblia','O que é a Bíblia?','Uma coleção de livros e histórias.',true,0) on conflict(id) do update set unit_id = excluded.unit_id,title = excluded.title,description = excluded.description,published = excluded.published,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('biblia-1','o-que-e-a-biblia','multiple_choice','O que é a Bíblia?','A Bíblia reúne diferentes livros, escritos em épocas e contextos distintos.','{"options":[{"id":"1","label":"Um único poema"},{"id":"2","label":"Uma coleção de livros"},{"id":"3","label":"Um mapa de cidades"}],"correctAnswer":"2"}'::jsonb,0) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('biblia-2','o-que-e-a-biblia','fill_blank','Complete a frase de Gênesis 1:1.','Gênesis começa com a narrativa da criação dos céus e da terra.','{"sentence":"No princípio, Deus criou os {{blank}} e a terra.","options":[{"id":"1","label":"mares"},{"id":"2","label":"céus"},{"id":"3","label":"desertos"}],"correctAnswer":"2"}'::jsonb,1) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('biblia-3','o-que-e-a-biblia','matching','Associe cada livro ao tipo de texto que ele contém.','Salmos reúne poemas e cânticos; Gênesis contém narrativas das origens; Romanos é uma carta.','{"options":[{"id":"1","label":"Salmos"},{"id":"2","label":"Gênesis"},{"id":"3","label":"Romanos"}],"rightOptions":[{"id":"1","label":"Carta"},{"id":"2","label":"Poemas e cânticos"},{"id":"3","label":"Narrativas das origens"}],"correctAnswer":{"1":"2","2":"3","3":"1"}}'::jsonb,2) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('biblia-4','o-que-e-a-biblia','ordering','Organize as divisões da Bíblia, da maior para a menor.','Um livro é dividido em capítulos, e os capítulos são divididos em versículos.','{"options":[{"id":"1","label":"Versículo"},{"id":"2","label":"Livro"},{"id":"3","label":"Capítulo"}],"correctAnswer":["2","3","1"]}'::jsonb,3) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('biblia-5','o-que-e-a-biblia','who_am_i','Quem sou eu?','Êxodo apresenta Moisés como líder na saída dos israelitas do Egito.','{"clues":["Minha história aparece no Antigo Testamento.","Enfrentei o faraó do Egito.","Liderei a saída dos israelitas do Egito."],"options":[{"id":"1","label":"Paulo"},{"id":"2","label":"Davi"},{"id":"3","label":"Moisés"}],"correctAnswer":"3"}'::jsonb,4) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.lessons(id,unit_id,title,description,published,order_index) values('antigo-e-novo-testamento','conhecendo-a-biblia','Antigo e Novo Testamento','Duas partes de uma grande história.',true,1) on conflict(id) do update set unit_id = excluded.unit_id,title = excluded.title,description = excluded.description,published = excluded.published,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('testamentos-1','antigo-e-novo-testamento','true_false','Os Evangelhos fazem parte do Novo Testamento.','Mateus, Marcos, Lucas e João estão no Novo Testamento e narram a vida e os ensinamentos de Jesus.','{"options":[{"id":"true","label":"Verdadeiro"},{"id":"false","label":"Falso"}],"correctAnswer":"true"}'::jsonb,0) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('testamentos-2','antigo-e-novo-testamento','multi_select','Quais destes livros são Evangelhos?','Mateus, Marcos, Lucas e João são Evangelhos. Romanos é uma carta.','{"options":[{"id":"1","label":"Mateus"},{"id":"2","label":"Romanos"},{"id":"3","label":"Marcos"},{"id":"4","label":"Lucas"},{"id":"5","label":"João"}],"correctAnswer":["1","3","4","5"]}'::jsonb,1) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('testamentos-3','antigo-e-novo-testamento','fill_blank','Complete a divisão do livro.','Gênesis é o primeiro livro do Antigo Testamento.','{"sentence":"Gênesis pertence ao {{blank}} Testamento.","options":[{"id":"1","label":"Novo"},{"id":"2","label":"Antigo"},{"id":"3","label":"Terceiro"}],"correctAnswer":"2"}'::jsonb,2) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('testamentos-4','antigo-e-novo-testamento','matching','Associe cada livro ou grupo ao seu conteúdo.','Gênesis apresenta narrativas das origens; os Evangelhos narram a vida de Jesus; Romanos é uma carta.','{"options":[{"id":"1","label":"Gênesis"},{"id":"2","label":"Evangelhos"},{"id":"3","label":"Romanos"}],"rightOptions":[{"id":"1","label":"Vida e ensinamentos de Jesus"},{"id":"2","label":"Carta a uma comunidade cristã"},{"id":"3","label":"Narrativas das origens"}],"correctAnswer":{"1":"3","2":"1","3":"2"}}'::jsonb,3) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('testamentos-5','antigo-e-novo-testamento','who_am_i','Quem sou eu?','Atos narra viagens de Paulo, e várias cartas do Novo Testamento levam seu nome.','{"clues":["Minha história aparece no Novo Testamento.","Viajei para anunciar a mensagem de Jesus.","Várias cartas do Novo Testamento levam meu nome."],"options":[{"id":"1","label":"Moisés"},{"id":"2","label":"Paulo"},{"id":"3","label":"Noé"}],"correctAnswer":"2"}'::jsonb,4) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.lessons(id,unit_id,title,description,published,order_index) values('organizacao-da-biblia','conhecendo-a-biblia','Como a Bíblia é organizada','Livros, capítulos e versículos.',true,2) on conflict(id) do update set unit_id = excluded.unit_id,title = excluded.title,description = excluded.description,published = excluded.published,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('organizacao-1','organizacao-da-biblia','ordering','Organize os três primeiros livros da Bíblia cristã.','Na organização da Bíblia cristã, Gênesis é seguido por Êxodo e Levítico.','{"options":[{"id":"1","label":"Levítico"},{"id":"2","label":"Gênesis"},{"id":"3","label":"Êxodo"}],"correctAnswer":["2","3","1"]}'::jsonb,0) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('organizacao-2','organizacao-da-biblia','matching','Na referência João 3:16, associe cada parte.','João é o livro, 3 é o capítulo e 16 é o versículo.','{"options":[{"id":"1","label":"Livro"},{"id":"2","label":"Capítulo"},{"id":"3","label":"Versículo"}],"rightOptions":[{"id":"1","label":"16"},{"id":"2","label":"João"},{"id":"3","label":"3"}],"correctAnswer":{"1":"2","2":"3","3":"1"}}'::jsonb,1) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('organizacao-3','organizacao-da-biblia','multiple_choice','Qual livro reúne muitos poemas, cânticos e orações?','Salmos reúne textos poéticos que expressam louvor, pedidos, gratidão e outros sentimentos.','{"options":[{"id":"1","label":"Romanos"},{"id":"2","label":"Salmos"},{"id":"3","label":"Atos dos Apóstolos"}],"correctAnswer":"2"}'::jsonb,2) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('organizacao-4','organizacao-da-biblia','multi_select','Quais afirmações sobre João 3:16 estão corretas?','O número antes dos dois-pontos é o capítulo; o número depois deles é o versículo.','{"options":[{"id":"1","label":"O livro é João"},{"id":"2","label":"O capítulo é 16"},{"id":"3","label":"O capítulo é 3"},{"id":"4","label":"O versículo é 16"}],"correctAnswer":["1","3","4"]}'::jsonb,3) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('organizacao-5','organizacao-da-biblia','true_false','Os livros bíblicos estão todos em uma ordem cronológica exata dos acontecimentos.','A organização também considera gêneros e tradições; não é uma linha do tempo exata.','{"options":[{"id":"true","label":"Verdadeiro"},{"id":"false","label":"Falso"}],"correctAnswer":"false"}'::jsonb,4) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.lessons(id,unit_id,title,description,published,order_index) values('revisao','conhecendo-a-biblia','Revisão','Reúna o que você aprendeu.',true,3) on conflict(id) do update set unit_id = excluded.unit_id,title = excluded.title,description = excluded.description,published = excluded.published,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('revisao-1','revisao','multi_select','Selecione os Evangelhos nesta coleção de livros.','Mateus, Marcos, Lucas e João são os quatro Evangelhos do Novo Testamento.','{"options":[{"id":"1","label":"Romanos"},{"id":"2","label":"Lucas"},{"id":"3","label":"Mateus"},{"id":"4","label":"João"},{"id":"5","label":"Marcos"}],"correctAnswer":["2","3","4","5"]}'::jsonb,0) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('revisao-2','revisao','fill_blank','Complete a referência bíblica.','O número depois dos dois-pontos indica o versículo: neste caso, 3.','{"sentence":"Em Gênesis 1:3, o versículo é o {{blank}}.","options":[{"id":"1","label":"1"},{"id":"2","label":"Gênesis"},{"id":"3","label":"3"}],"correctAnswer":"3"}'::jsonb,1) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('revisao-3','revisao','ordering','Organize as divisões, da maior para a menor.','A referência bíblica identifica um livro, um capítulo desse livro e um versículo.','{"options":[{"id":"1","label":"Capítulo"},{"id":"2","label":"Versículo"},{"id":"3","label":"Livro"}],"correctAnswer":["3","1","2"]}'::jsonb,2) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('revisao-4','revisao','true_false','Moisés é apresentado como o construtor da arca na narrativa do dilúvio.','O construtor da arca é Noé. Moisés aparece na narrativa da saída do Egito.','{"options":[{"id":"true","label":"Verdadeiro"},{"id":"false","label":"Falso"}],"correctAnswer":"false"}'::jsonb,3) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('revisao-5','revisao','who_am_i','Quem sou eu?','Na narrativa de Gênesis, Noé constrói a arca para abrigar sua família e animais.','{"clues":["Minha história aparece em Gênesis.","Preparei um abrigo para minha família e animais.","Construí uma arca antes do dilúvio."],"options":[{"id":"1","label":"Moisés"},{"id":"2","label":"Davi"},{"id":"3","label":"Noé"}],"correctAnswer":"3"}'::jsonb,4) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.lessons(id,unit_id,title,description,published,order_index) values('personagens-importantes','personagens-e-historias','Personagens importantes','Conheça pessoas das narrativas bíblicas.',true,0) on conflict(id) do update set unit_id = excluded.unit_id,title = excluded.title,description = excluded.description,published = excluded.published,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('personagens-1','personagens-importantes','who_am_i','Quem sou eu?','Samuel narra a vitória de Davi sobre Golias e seu reinado; vários salmos são atribuídos a Davi.','{"clues":["Fui rei de Israel.","Derrotei Golias, segundo a narrativa de Samuel.","Meu nome aparece nos títulos de vários salmos."],"options":[{"id":"1","label":"Salomão"},{"id":"2","label":"Davi"},{"id":"3","label":"Noé"}],"correctAnswer":"2"}'::jsonb,0) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('personagens-2','personagens-importantes','matching','Associe cada pessoa à sua história.','Gênesis apresenta Noé e a arca; Êxodo apresenta Moisés; os Evangelhos apresentam Maria como mãe de Jesus.','{"options":[{"id":"1","label":"Noé"},{"id":"2","label":"Moisés"},{"id":"3","label":"Maria"}],"rightOptions":[{"id":"1","label":"Mãe de Jesus"},{"id":"2","label":"Arca do dilúvio"},{"id":"3","label":"Saída do Egito"}],"correctAnswer":{"1":"2","2":"3","3":"1"}}'::jsonb,1) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('personagens-3','personagens-importantes','ordering','Organize estes acontecimentos na narrativa de Gênesis.','Gênesis narra o chamado de Abraão antes dos nascimentos de Isaque, Jacó e José, nessa sequência.','{"options":[{"id":"1","label":"Nascimento de José"},{"id":"2","label":"Nascimento de Isaque"},{"id":"3","label":"Chamado de Abraão"},{"id":"4","label":"Nascimento de Jacó"}],"correctAnswer":["3","2","4","1"]}'::jsonb,2) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('personagens-4','personagens-importantes','fill_blank','Complete o nome da personagem.','Maria é apresentada nos Evangelhos como a mãe de Jesus.','{"sentence":"Nos Evangelhos, {{blank}} é apresentada como a mãe de Jesus.","options":[{"id":"1","label":"Rute"},{"id":"2","label":"Ester"},{"id":"3","label":"Maria"}],"correctAnswer":"3"}'::jsonb,3) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('personagens-5','personagens-importantes','multiple_choice','Quem está ligado a viagens e cartas no Novo Testamento?','Atos narra viagens de Paulo, e várias cartas do Novo Testamento levam seu nome.','{"options":[{"id":"1","label":"Paulo"},{"id":"2","label":"Abraão"},{"id":"3","label":"Noé"}],"correctAnswer":"1"}'::jsonb,4) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.lessons(id,unit_id,title,description,published,order_index) values('criacao-noe-e-abraao','personagens-e-historias','Dos começos à promessa','Criação, Noé e a família de Abraão.',true,1) on conflict(id) do update set unit_id = excluded.unit_id,title = excluded.title,description = excluded.description,published = excluded.published,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('origens-1','criacao-noe-e-abraao','fill_blank','Complete a narrativa da criação.','Gênesis 1:5 chama a luz de dia e as trevas de noite.','{"sentence":"Em Gênesis, Deus chama a {{blank}} de dia.","options":[{"id":"1","label":"luz"},{"id":"2","label":"água"},{"id":"3","label":"terra"}],"correctAnswer":"1"}'::jsonb,0) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('origens-2','criacao-noe-e-abraao','who_am_i','Quem sou eu?','Gênesis 6–9 apresenta Noé, sua família e a arca.','{"clues":["Minha história está em Gênesis.","Minha família e animais foram abrigados juntos.","Construí uma arca na narrativa do dilúvio."],"options":[{"id":"1","label":"Abraão"},{"id":"2","label":"Noé"},{"id":"3","label":"Moisés"}],"correctAnswer":"2"}'::jsonb,1) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('origens-3','criacao-noe-e-abraao','ordering','Ordene estes acontecimentos na narrativa de Gênesis.','A narrativa passa pela criação, pelo dilúvio, pelo chamado de Abraão e pelo nascimento de Isaque.','{"options":[{"id":"1","label":"Chamado de Abraão"},{"id":"2","label":"Criação"},{"id":"3","label":"Nascimento de Isaque"},{"id":"4","label":"Dilúvio"}],"correctAnswer":["2","4","1","3"]}'::jsonb,2) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('origens-4','criacao-noe-e-abraao','matching','Associe cada pessoa à sua relação familiar em Gênesis.','Abraão é pai de Isaque, Isaque é pai de Jacó e José é filho de Jacó.','{"options":[{"id":"1","label":"Abraão"},{"id":"2","label":"Isaque"},{"id":"3","label":"José"}],"rightOptions":[{"id":"1","label":"Filho de Jacó"},{"id":"2","label":"Pai de Isaque"},{"id":"3","label":"Pai de Jacó"}],"correctAnswer":{"1":"2","2":"3","3":"1"}}'::jsonb,3) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('origens-5','criacao-noe-e-abraao','true_false','Segundo Gênesis, Isaque é filho de Abraão e Sara.','Gênesis 21 narra o nascimento de Isaque, filho de Abraão e Sara.','{"options":[{"id":"true","label":"Verdadeiro"},{"id":"false","label":"Falso"}],"correctAnswer":"true"}'::jsonb,4) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.lessons(id,unit_id,title,description,published,order_index) values('moises-e-davi','personagens-e-historias','Moisés e Davi','Libertação, coragem e liderança.',true,2) on conflict(id) do update set unit_id = excluded.unit_id,title = excluded.title,description = excluded.description,published = excluded.published,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('lideres-1','moises-e-davi','multiple_choice','Em qual livro é narrada a saída dos israelitas do Egito?','Êxodo narra a saída do Egito e apresenta Moisés como líder.','{"options":[{"id":"1","label":"Salmos"},{"id":"2","label":"Êxodo"},{"id":"3","label":"Romanos"}],"correctAnswer":"2"}'::jsonb,0) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('lideres-2','moises-e-davi','matching','Associe as pessoas às narrativas em que aparecem.','Moisés lidera a saída do Egito; Davi enfrenta Golias e depois se torna rei de Israel.','{"options":[{"id":"1","label":"Moisés"},{"id":"2","label":"Davi"},{"id":"3","label":"Golias"}],"rightOptions":[{"id":"1","label":"Rei de Israel"},{"id":"2","label":"Oponente enfrentado por Davi"},{"id":"3","label":"Líder na saída do Egito"}],"correctAnswer":{"1":"3","2":"1","3":"2"}}'::jsonb,1) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('lideres-3','moises-e-davi','multi_select','Quais acontecimentos pertencem à história de Moisés?','Êxodo associa Moisés à saída do Egito e aos mandamentos no Sinai.','{"options":[{"id":"1","label":"Saída do Egito"},{"id":"2","label":"Construção da arca de Noé"},{"id":"3","label":"Entrega dos mandamentos no Sinai"},{"id":"4","label":"Viagens de Paulo"}],"correctAnswer":["1","3"]}'::jsonb,2) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('lideres-4','moises-e-davi','who_am_i','Quem sou eu?','Samuel apresenta Davi como pastor, vencedor de Golias e futuro rei.','{"clues":["Antes de ser rei, cuidei de ovelhas.","Enfrentei Golias.","Meu nome está associado a vários salmos."],"options":[{"id":"1","label":"Davi"},{"id":"2","label":"Paulo"},{"id":"3","label":"Abraão"}],"correctAnswer":"1"}'::jsonb,3) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('lideres-5','moises-e-davi','ordering','Organize estes momentos da história de Davi.','Na narrativa de Samuel, Davi cuida de ovelhas, enfrenta Golias e mais tarde se torna rei.','{"options":[{"id":"1","label":"Torna-se rei"},{"id":"2","label":"Cuida de ovelhas"},{"id":"3","label":"Enfrenta Golias"}],"correctAnswer":["2","3","1"]}'::jsonb,4) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.lessons(id,unit_id,title,description,published,order_index) values('jesus-e-paulo','personagens-e-historias','Jesus e os primeiros cristãos','Evangelhos, viagens e cartas.',true,3) on conflict(id) do update set unit_id = excluded.unit_id,title = excluded.title,description = excluded.description,published = excluded.published,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('novo-1','jesus-e-paulo','multi_select','Quais livros narram a vida e os ensinamentos de Jesus?','Mateus e João são Evangelhos; Romanos é uma carta e Gênesis pertence ao Antigo Testamento.','{"options":[{"id":"1","label":"Mateus"},{"id":"2","label":"Romanos"},{"id":"3","label":"João"},{"id":"4","label":"Gênesis"}],"correctAnswer":["1","3"]}'::jsonb,0) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('novo-2','jesus-e-paulo','fill_blank','Complete o nome do lugar.','Mateus 2 e Lucas 2 situam o nascimento de Jesus em Belém.','{"sentence":"Nos Evangelhos, Jesus é apresentado como nascido em {{blank}}.","options":[{"id":"1","label":"Roma"},{"id":"2","label":"Belém"},{"id":"3","label":"Atenas"}],"correctAnswer":"2"}'::jsonb,1) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('novo-3','jesus-e-paulo','true_false','Paulo está ligado a viagens missionárias narradas em Atos.','Atos narra viagens de Paulo para anunciar a mensagem de Jesus.','{"options":[{"id":"true","label":"Verdadeiro"},{"id":"false","label":"Falso"}],"correctAnswer":"true"}'::jsonb,2) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('novo-4','jesus-e-paulo','matching','Associe os livros ao seu conteúdo principal.','Lucas é um Evangelho, Atos narra os primeiros cristãos e Romanos é uma carta.','{"options":[{"id":"1","label":"Lucas"},{"id":"2","label":"Atos"},{"id":"3","label":"Romanos"}],"rightOptions":[{"id":"1","label":"Carta a uma comunidade cristã"},{"id":"2","label":"Vida e ensinamentos de Jesus"},{"id":"3","label":"Primeiros cristãos e suas viagens"}],"correctAnswer":{"1":"2","2":"3","3":"1"}}'::jsonb,3) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index) values('novo-5','jesus-e-paulo','who_am_i','Quem sou eu?','Paulo aparece em Atos e seu nome está associado a várias cartas do Novo Testamento.','{"clues":["Minha história aparece em Atos.","Viajei entre diferentes comunidades.","Várias cartas do Novo Testamento levam meu nome."],"options":[{"id":"1","label":"Noé"},{"id":"2","label":"Davi"},{"id":"3","label":"Paulo"}],"correctAnswer":"3"}'::jsonb,4) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index;

-- Included by generate-seed.ts in the atomic curriculum migration.
create or replace function public.assert_lesson_available(p_user uuid, p_lesson text) returns void
language plpgsql security definer set search_path = '' as $$
declare target public.lessons; target_unit public.units;
begin
  select l.* into target from public.lessons l join public.units u on u.id=l.unit_id
    join public.courses c on c.id=u.course_id where l.id=p_lesson and l.published and u.published and c.published;
  if not found then raise exception 'content_unavailable'; end if;
  select * into target_unit from public.units where id=target.unit_id;
  -- Previously earned lessons remain reviewable after moving between units.
  if exists(select 1 from public.user_lesson_progress where user_id=p_user and lesson_id=p_lesson and status in ('completed','mastered')) then return; end if;
  -- Preserve a lesson unlocked before the move, including offline queued attempts.
  if p_lesson='personagens-importantes' and exists(select 1 from public.user_lesson_progress where user_id=p_user and lesson_id=p_lesson and status in ('available','in_progress'))
    and not exists(select 1 from public.lessons l where l.id in ('o-que-e-a-biblia','antigo-e-novo-testamento','organizacao-da-biblia')
      and not exists(select 1 from public.user_lesson_progress p where p.user_id=p_user and p.lesson_id=l.id and p.status in ('completed','mastered'))) then return; end if;
  if exists(select 1 from public.lessons l join public.units u on u.id=l.unit_id
    where u.course_id=target_unit.course_id and u.published and l.published
      and (u.order_index < target_unit.order_index or (u.id=target_unit.id and l.order_index < target.order_index))
      and not exists(select 1 from public.user_lesson_progress p where p.user_id=p_user and p.lesson_id=l.id and p.status in ('completed','mastered')))
    then raise exception 'lesson_locked'; end if;
end;
$$;

create or replace function public.learning_snapshot(p_unit text default 'conhecendo-a-biblia') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare owner uuid := auth.uid(); person public.profiles; completed jsonb; last_result jsonb; v_course_id text; root_id text;
begin
  if owner is null then raise exception 'auth_required'; end if;
  select * into person from public.profiles where id=owner;
  if not found then raise exception 'profile_missing'; end if;
  select u.course_id into v_course_id from public.units u where u.id=p_unit;
  if not found then raise exception 'content_unavailable'; end if;
  select u.id into root_id from public.units u where u.course_id=v_course_id and u.published order by u.order_index limit 1;
  select coalesce(jsonb_agg(l.id order by u.order_index,l.order_index),'[]'::jsonb) into completed
    from public.user_lesson_progress p join public.lessons l on l.id=p.lesson_id join public.units u on u.id=l.unit_id
    where p.user_id=owner and p.status in ('completed','mastered') and u.course_id=v_course_id and u.published and l.published;
  select a.result into last_result from public.lesson_attempts a join public.lessons l on l.id=a.lesson_id join public.units u on u.id=l.unit_id
    where a.user_id=owner and u.course_id=v_course_id and u.published and l.published order by a.created_at desc,a.id desc limit 1;
  return jsonb_build_object('unitId',root_id,'xp',person.xp_total,'completedLessonIds',completed,'lastResult',last_result,
    'profile',jsonb_build_object('id',owner,'display_name',person.display_name,'username',person.username,
      'avatar_key',person.avatar_key,'xp_total',person.xp_total,
      'current_streak',case when person.last_activity_date>=public.learning_day()-1 then person.current_streak else 0 end,
      'longest_streak',person.longest_streak,'last_activity_date',person.last_activity_date,'created_at',person.created_at,'updated_at',person.updated_at),
    'guestImported',exists(select 1 from public.guest_progress_imports where user_id=owner));
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
  select coalesce(sum(10+2*(select count(*) from public.questions q where q.lesson_id=l.id and q.type<>'content_card')+5),0)::integer into max_xp
    from public.lessons l where l.id in(select jsonb_array_elements_text(p_completed_ids));
  if p_xp<n*10 or p_xp>max_xp then raise exception 'guest_invalid'; end if;
  remaining:=p_xp-n*10;
  for imported_lesson_id in select jsonb_array_elements_text(p_completed_ids) loop
    select 10+least(remaining,2*count(*)::integer+5) into award from public.questions q where q.lesson_id=imported_lesson_id and q.type<>'content_card';
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
revoke all on function public.assert_lesson_available(uuid,text) from public,anon,authenticated;
revoke all on function public.learning_snapshot(text),public.import_guest_progress(text,jsonb,integer) from public,anon;
grant execute on function public.learning_snapshot(text),public.import_guest_progress(text,jsonb,integer) to authenticated;

commit;
