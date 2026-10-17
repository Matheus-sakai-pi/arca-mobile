import assert from 'node:assert/strict';
import { test } from 'node:test';
import { learningUnits } from '../../src/data/lessons.ts';
import { createTestDatabase } from '../helpers/database.ts';

// Depois de todas as migrations, o banco deve ter exatamente o mesmo texto e respostas do app.
test('database questions match the app curriculum after all migrations', async t => {
  const db = await createTestDatabase(); t.after(() => db.close());
  const rows = (await db.query<{ id: string; type: string; prompt: string; explanation: string; content: Record<string, unknown> }>('select id,type,prompt,explanation,content from public.questions')).rows;
  const byId = new Map(rows.map(row => [row.id, row]));
  let checked = 0;
  for (const unit of learningUnits) for (const lesson of unit.lessons) for (const question of lesson.questions) {
    const { id, type, prompt, explanation, ...content } = question as typeof question & { explanation?: string };
    const row = byId.get(id);
    assert.ok(row, `pergunta ausente no banco: ${id}`);
    assert.equal(row.type, type, id);
    assert.equal(row.prompt, prompt, id);
    assert.equal(row.explanation ?? '', explanation ?? '', id);
    assert.deepEqual(row.content, JSON.parse(JSON.stringify(content)), id);
    checked++;
  }
  assert.equal(checked, 1002);
});
