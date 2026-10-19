import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTestDatabase, createTestUser, databaseRpc } from '../helpers/database.ts';

type Rate = { eligible: number; retained: number };
type Growth = {
  retention: { summary: Record<'d1' | 'd7' | 'd30', Rate>; cohorts: { week: string; users: number; d1: Rate; d7: Rate; d30: Rate }[] };
  activity: { dau: number; wau: number; mau: number; stickyUserDays: number; stickyUsers: number; days: { day: string; active: number }[] };
  funnel: { signups: number; firstLesson: number; threeLessons: number; firstUnit: number };
  battery: { enabled: boolean; sessions: number; stopped: number; stoppedUsers: number; blockedUsers: number; returnedUsers: number };
};

const id = (n: number) => `00000000-0000-4000-8000-0000000009${String(n).padStart(2, '0')}`;

test('admin growth: retention, active users, first-day funnel and battery stops', async t => {
  const db = await createTestDatabase(); t.after(() => db.close());
  const [admin, u1, u2, u3, u4] = [1, 2, 3, 4, 5].map(id) as [string, string, string, string, string];
  for (const [user, name] of [[admin, 'admin_g'], [u1, 'aluno_um'], [u2, 'aluno_dois'], [u3, 'aluno_tres'], [u4, 'aluno_quatro']]) await createTestUser(db, user!, name!);
  await db.query('insert into arca_admins(user_id) values($1)', [admin]);
  await assert.rejects(databaseRpc(db, u1, 'arca_admin_growth'), /admin_required/);

  const lessons = (await db.query<{ id: string }>(`select l.id from public.lessons l join public.units u on u.id=l.unit_id join public.courses c on c.id=u.course_id
    where l.published and u.published and c.published and u.id=(select u2.id from public.units u2 join public.courses c2 on c2.id=u2.course_id where u2.published and c2.published order by c2.order_index,u2.order_index limit 1)
    order by l.order_index`)).rows.map(row => row.id);
  assert.ok(lessons.length >= 3);
  const question = (await db.query<{ id: string }>('select id from public.questions where lesson_id=$1 order by order_index limit 1', [lessons[0]])).rows[0]!.id;

  // Cadastros: u1 e u2 há 10 dias, u3 há 40 dias, u4 agora (o admin fica fora da janela de 91 dias).
  await db.query(`update public.profiles set created_at=case id
    when $1 then (current_date-10)::timestamptz+interval '12 hours' when $2 then (current_date-10)::timestamptz+interval '12 hours'
    when $3 then (current_date-40)::timestamptz+interval '12 hours' when $4 then now()-interval '1 minute' else now()-interval '200 days' end`, [u1, u2, u3, u4]);
  let key = 0;
  const attempt = (user: string, lesson: string, at: string) =>
    db.query(`insert into public.lesson_attempts(user_id,lesson_id,attempt_key,answers,result,created_at) values($1,$2,$3,'{}','{}',${at})`, [user, lesson, `k${++key}`]);
  // u1 conclui a 1ª unidade no primeiro dia e volta nos dias 1 e 7.
  for (const lesson of lessons) await attempt(u1, lesson, "(current_date-10)::timestamptz+interval '13 hours'");
  await attempt(u1, lessons[0]!, "(current_date-9)::timestamptz+interval '12 hours'");
  await attempt(u1, lessons[0]!, "(current_date-3)::timestamptz+interval '12 hours'");
  await attempt(u2, lessons[0]!, "(current_date-10)::timestamptz+interval '14 hours'");
  await attempt(u3, lessons[0]!, "(current_date-10)::timestamptz+interval '12 hours'");
  await attempt(u4, lessons[0]!, 'now()');

  // Bateria: u2 tinha uma sessão antiga, abriu outra e ficou sem bateria nela. u1 concluiu; u3 parou sem bloqueio.
  const wallet = async (user: string) => (await db.query<{ id: string }>('insert into public.battery_wallets(user_id,balance) values($1,0) returning id', [user])).rows[0]!.id;
  const session = async (walletId: string, attemptId: string, completed: boolean, at: string) => {
    await db.query('insert into public.battery_sessions(wallet_id,attempt_id,lesson_id,queue,completed) values($1,$2,$3,$4,$5)', [walletId, attemptId, lessons[0], [], completed]);
    await db.query(`insert into public.battery_events(wallet_id,attempt_id,turn,question_id,answer,receipt,created_at) values($1,$2,0,$3,'"x"','{"charged":1}',${at})`, [walletId, attemptId, question]);
  };
  const w2 = await wallet(u2);
  await session(w2, 'a-old', false, "now()-interval '4 hours'");
  await session(w2, 'a-stop', false, "now()-interval '2 hours'");
  await db.query("insert into public.learning_energy_daily(user_id,day,blocked,last_blocked_at) values($1,current_date,2,now()-interval '1 hour')", [u2]);
  await session(await wallet(u1), 'a-done', true, "now()-interval '3 hours'");
  await session(await wallet(u3), 'a-open', false, "now()-interval '5 hours'");

  const growth = await databaseRpc<Growth>(db, admin, 'arca_admin_growth');
  assert.deepEqual(growth.retention.summary, { d1: { eligible: 3, retained: 1 }, d7: { eligible: 3, retained: 1 }, d30: { eligible: 1, retained: 1 } });
  assert.equal(growth.retention.cohorts.length, 8);
  assert.equal(growth.retention.cohorts.reduce((sum, cohort) => sum + cohort.users, 0), 4);
  assert.deepEqual({ ...growth.activity, days: growth.activity.days.length }, { dau: 1, wau: 2, mau: 4, stickyUserDays: 5, stickyUsers: 3, days: 30 });
  assert.deepEqual(growth.funnel, { signups: 2, firstLesson: 2, threeLessons: 1, firstUnit: 1 });
  assert.deepEqual(growth.battery, { enabled: false, sessions: 4, stopped: 1, stoppedUsers: 1, blockedUsers: 1, returnedUsers: 0 });
});
