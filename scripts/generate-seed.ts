import { readFile, writeFile } from 'node:fs/promises';
import { initialUnit, learningUnits } from '../src/data/lessons.ts';

const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
export function learningSeed(): string {
  const rows = [
    '-- Generated from src/data/lessons.ts. Run with the SQL Editor or Supabase CLI.\nbegin;',
    "insert into public.courses(id,title,description,published,order_index) values('biblia-basica','Conhecendo a Bíblia','Uma jornada pelos fundamentos bíblicos.',true,0) on conflict(id) do update set title = excluded.title, description = excluded.description, published = excluded.published;",
    ...learningUnits.map((unit,index) => `insert into public.units(id,course_id,title,published,order_index) values(${quote(unit.id)},'biblia-basica',${quote(unit.title)},true,${index}) on conflict(id) do update set title = excluded.title,published = excluded.published,order_index = excluded.order_index;`),
    "-- Free existing order slots without deleting lessons or dependent progress.\nupdate public.lessons set order_index = order_index + (select coalesce(max(order_index),0) + 1 from public.lessons) where unit_id in (select id from public.units where course_id='biblia-basica');",
    "-- Retain original questions for offline attempts; hide them from the current curriculum.\nupdate public.questions set order_index=order_index+1000 where order_index<1000 and id not like '%-v2' and id not like '%-practice-v3';\nupdate public.questions set order_index=order_index+100 where order_index<1000;",
  ];
  initialUnit.lessons.forEach(lesson => {
    const order = learningUnits.find(unit=>unit.id === lesson.unitId)!.lessons.findIndex(item=>item.id === lesson.id);
    rows.push(`insert into public.lessons(id,unit_id,title,description,published,order_index) values(${quote(lesson.id)},${quote(lesson.unitId)},${quote(lesson.title)},${quote(lesson.description)},true,${order}) on conflict(id) do update set unit_id = excluded.unit_id,title = excluded.title,description = excluded.description,published = excluded.published,order_index = excluded.order_index;`);
    lesson.questions.forEach((question, index) => {
      const { id, type, prompt, explanation, ...content } = question;
      rows.push(`insert into public.questions(id,lesson_id,type,prompt,explanation,content,order_index,curriculum_revision) values(${quote(id)},${quote(lesson.id)},${quote(type)},${quote(prompt)},${quote(explanation)},${quote(JSON.stringify(content))}::jsonb,${index},${id.endsWith('-practice-v3') ? 3 : 2}) on conflict(id) do update set type = excluded.type,prompt = excluded.prompt,explanation = excluded.explanation,content = excluded.content,order_index = excluded.order_index,curriculum_revision = excluded.curriculum_revision;`);
    });
  });
  rows.push('commit;');
  return rows.join('\n\n') + '\n';
}
if (process.argv[1]?.replaceAll('\\','/').endsWith('/generate-seed.ts')) {
  await writeFile(new URL('../supabase/seed.sql',import.meta.url),learningSeed());
  // Existing migrations are immutable. New types and content get an additive upgrade.
  const upgrade = await readFile(new URL('../supabase/templates/ten-exercises.sql',import.meta.url),'utf8');
  const original = await readFile(new URL('../supabase/templates/varied-exercises.sql',import.meta.url),'utf8');
  const start = original.indexOf('create or replace function public.complete_learning_lesson(');
  const end = original.indexOf('create or replace function public.import_guest_progress(', start);
  if (start < 0 || end < 0) throw new Error('Completion function not found.');
  const completion = original.slice(start, end)
    .replace('current_revision boolean;', 'current_revision boolean; answer_revision integer;')
    .replace('  if (select count(*) from jsonb_object_keys(p_answers))', "  answer_revision := case when exists(select 1 from public.questions where lesson_id=p_lesson_id and curriculum_revision=3 and p_answers ? id) then 3 else 2 end;\n  if (select count(*) from jsonb_object_keys(p_answers))")
    .replaceAll('then order_index<1000 else', 'then order_index<1000 and curriculum_revision<=answer_revision else');
  await writeFile(new URL('../supabase/migrations/202610140001_ten_exercises.sql',import.meta.url),upgrade.replace('-- COMPLETION_FUNCTION', () => completion).replace('-- CURRENT_CURRICULUM', () => learningSeed().replace(/^.*?begin;/s,'').replace(/commit;\s*$/,'')));
  const catalog = ['# Currículo: 100 lições em 10 unidades', '',
    'Dez exercícios avaliativos por lição: 1.000 no total. As duas leituras existentes são adicionais e não concedem XP. As cinco perguntas complementares reforçam os fatos de cada lição em formatos variados.', '',
    ...learningUnits.flatMap((unit,index)=>[
      `## Unidade ${index+1}: ${unit.title}`, '',
      ...unit.lessons.map((lesson,position)=>`${position+1}. **${lesson.title}** (${lesson.id}) — ${lesson.description}`), '',
    ]),
  ].join('\n');
  await writeFile(new URL('../artifacts/CURRICULO-100-LICOES.md',import.meta.url),catalog+'\n');
}
