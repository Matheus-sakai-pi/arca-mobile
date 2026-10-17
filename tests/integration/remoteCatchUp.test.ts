import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { learningUnits } from '../../src/data/lessons.ts';

// Reproduz o banco remoto de 18/10/2026: todas as migrations até 202610170003, exceto
// 202610140001_ten_exercises.sql. O pacote de atualização deve deixá-lo igual ao app.
test('catch-up bundle fixes a remote database that skipped the ten-question migration', async t => {
  const skipped = '202610140001_ten_exercises.sql';
  // O helper de testes aplica todos os arquivos; aqui o banco é montado à mão, pulando um deles.
  const { PGlite } = await import('@electric-sql/pglite');
  const remote = await PGlite.create(); t.after(() => remote.close());
  await remote.exec(`
    create role anon nologin; create role authenticated nologin; create schema auth;
    create table auth.users (id uuid primary key, raw_user_meta_data jsonb, email text, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to anon, authenticated;`);
  const { readdir } = await import('node:fs/promises');
  const folder = new URL('../../supabase/migrations/', import.meta.url);
  for (const file of (await readdir(folder)).filter(name => name.endsWith('.sql') && name <= '202610170003_unit_chest_energy.sql').sort()) {
    if (file === skipped) continue;
    await remote.exec(await readFile(new URL(file, folder), 'utf8'));
  }
  const missingColumn = await remote.query("select 1 from information_schema.columns where table_name='questions' and column_name='curriculum_revision'");
  assert.equal(missingColumn.rows.length, 0, 'o banco simulado deve começar sem curriculum_revision');

  await remote.exec(await readFile(new URL('../../artifacts/supabase-2026-10-18/ATUALIZAR-SUPABASE.sql', import.meta.url), 'utf8'));

  // A versão com bateria continua sendo a função pública; a interna ganhou as 10 perguntas.
  const fn = async (name: string) => (await remote.query<{ src: string; acl: string | null }>("select prosrc src, proacl::text acl from pg_proc where proname=$1", [name])).rows[0]!;
  const wrapper = await fn('complete_learning_lesson'), inner = await fn('complete_learning_lesson_before_battery');
  assert.match(wrapper.src, /complete_learning_lesson_before_battery/);
  assert.match(inner.src, /curriculum_revision/);
  // Só o dono do banco executa a função interna (sem anon, authenticated ou público).
  assert.doesNotMatch(inner.acl ?? '', /authenticated=|anon=|[{,]=/);

  // Conteúdo idêntico ao app, bateria 30 e tabela de configurações criada.
  const rows = (await remote.query<{ id: string; prompt: string; content: Record<string, unknown> }>('select id,prompt,content from public.questions')).rows;
  const byId = new Map(rows.map(row => [row.id, row]));
  let checked = 0;
  for (const unit of learningUnits) for (const lesson of unit.lessons) for (const question of lesson.questions) {
    const { id, prompt } = question;
    const content = Object.fromEntries(Object.entries(question).filter(([key]) => !['id', 'type', 'prompt', 'explanation'].includes(key)));
    assert.equal(byId.get(id)?.prompt, prompt, id);
    assert.deepEqual(byId.get(id)?.content, JSON.parse(JSON.stringify(content)), id);
    checked++;
  }
  assert.equal(checked, 1002);
  assert.equal((await remote.query<{ c: number }>("select (rules->>'capacity')::int c from public.battery_rules where singleton")).rows[0]!.c, 30);
  assert.equal((await remote.query("select 1 from information_schema.tables where table_name='user_settings'")).rows.length, 1);
});
