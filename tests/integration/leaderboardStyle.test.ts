import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTestDatabase, createTestUser, databaseRpc } from '../helpers/database.ts';

type Row = { id: string; frame: string; vip: boolean };
type Ranking = { top: Row[]; current: Row | null };

test('ranking shows frame and VIP tag only while VIP is active, in every scope', async t => {
  const db = await createTestDatabase(); t.after(() => db.close());
  const [vip, free, lapsed] = ['00000000-0000-4000-8000-000000000a01', '00000000-0000-4000-8000-000000000a02', '00000000-0000-4000-8000-000000000a03'];
  await createTestUser(db, vip, 'ranking_vip'); await createTestUser(db, free, 'ranking_free'); await createTestUser(db, lapsed, 'ranking_lapsed');
  await db.query("update public.profiles set xp_total=case id when $1 then 300 when $2 then 200 else 100 end", [vip, free]);
  // VIP ativo com moldura dourada e selo; outro com estilo salvo mas VIP vencido; um gratuito.
  await db.query(`insert into public.admin_vip_grants(request_key,user_id,starts_at,expires_at,reason) values
    ('ranking-vip',$1,now()-interval '1 day',now()+interval '30 days','teste'),
    ('ranking-lapsed',$2,now()-interval '40 days',now()-interval '10 days','teste')`, [vip, lapsed]);
  await db.query(`insert into public.profile_appearance(user_id,frame_key,background_key,show_badge) values
    ($1,'gold','garden',true),($2,'starlight','stars',true)`, [vip, lapsed]);

  const style = (rows: Row[]) => Object.fromEntries(rows.map(row => [row.id, { frame: row.frame, vip: row.vip }]));
  const total = await databaseRpc<Ranking>(db, null, 'learning_leaderboard');
  assert.deepEqual(style(total.top), {
    [vip]: { frame: 'gold', vip: true },
    [free]: { frame: 'classic', vip: false },
    [lapsed]: { frame: 'classic', vip: false },
  });
  const own = await databaseRpc<Ranking>(db, vip, 'learning_leaderboard');
  assert.deepEqual({ frame: own.current!.frame, vip: own.current!.vip }, { frame: 'gold', vip: true });
  const weekly = await databaseRpc<Ranking>(db, vip, 'learning_leaderboard_scope', { p_scope: 'weekly' });
  assert.deepEqual(style(weekly.top)[vip], { frame: 'gold', vip: true });

  // Selo desligado no perfil: a moldura continua, o selo some.
  await db.query('update public.profile_appearance set show_badge=false where user_id=$1', [vip]);
  const hidden = await databaseRpc<Ranking>(db, vip, 'learning_leaderboard_scope', { p_scope: 'friends' });
  assert.deepEqual(style(hidden.top)[vip], { frame: 'gold', vip: false });
  // A função auxiliar não fica exposta para chamadas diretas.
  await assert.rejects(databaseRpc(db, vip, 'leaderboard_style', { p_user: vip }));
});
