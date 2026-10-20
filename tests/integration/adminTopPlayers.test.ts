import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTestDatabase, createTestUser, databaseRpc } from '../helpers/database.ts';
import { journeyUnits, initialUnit } from '../../src/data/lessons.ts';

type Player = { name: string; xp: number; streak: number; completed: number; lastActivity: string | null;
  current: { unit: number; unitTitle: string; lesson: string; position: number } | null };

test('admin top players: most lessons first, current phase in trail order, admin only', async t => {
  const db = await createTestDatabase(); t.after(() => db.close());
  const ids = [1, 2, 3, 4].map(n => `00000000-0000-4000-8000-000000000c0${n}`) as [string, string, string, string];
  const [admin, ahead, behind, idle] = ids;
  for (const [id, name] of [[admin, 'chefe'], [ahead, 'adiantado'], [behind, 'iniciante'], [idle, 'parado']] as const) await createTestUser(db, id, name);
  await db.query('insert into arca_admins(user_id) values($1)', [admin]);
  await assert.rejects(databaseRpc(db, ahead, 'arca_admin_top_players'), /admin_required/);

  const lessons = initialUnit.lessons;
  const complete = async (user: string, count: number) => {
    for (const lesson of lessons.slice(0, count)) await db.query(
      "insert into user_lesson_progress(user_id,lesson_id,status,completed_at) values($1,$2,'completed',now())", [user, lesson.id]);
  };
  await complete(ahead, 12); await complete(behind, 3);
  await db.query("update profiles set xp_total=case id when $1 then 420 when $2 then 90 else 0 end", [ahead, behind]);
  await db.query("insert into lesson_attempts(user_id,lesson_id,attempt_key,answers,result) values($1,$2,'k1','{}','{}')", [ahead, lessons[11]!.id]);

  const result = await databaseRpc<{ total: number; players: Player[] }>(db, admin, 'arca_admin_top_players');
  assert.equal(result.total, lessons.length);
  assert.deepEqual(result.players.map(player => player.name), ['@adiantado', '@iniciante']);
  const [first, second] = result.players as [Player, Player];
  const unitTwo = journeyUnits(initialUnit)[1]!;
  // 12 lições: a próxima é a 13ª, que é a 3ª lição da Unidade 2.
  assert.deepEqual(first.current, { unit: 2, unitTitle: unitTwo.title, lesson: lessons[12]!.title, position: 13 });
  assert.equal(first.completed, 12); assert.equal(first.xp, 420); assert.ok(first.lastActivity);
  assert.deepEqual(second.current?.position, 4); assert.equal(second.lastActivity, null);
});
