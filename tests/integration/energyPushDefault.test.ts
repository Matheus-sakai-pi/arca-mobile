import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTestDatabase, createTestUser, databaseRpc } from '../helpers/database.ts';

const fresh = '00000000-0000-4000-8000-000000000b01', optedOut = '00000000-0000-4000-8000-000000000b02';
const tokenA = 'ExpoPushToken[energydefaultaaaaaaaa]', tokenB = 'ExpoPushToken[energydefaultbbbbbbbb]';

test('energy alert is on by default when allowing notifications, but an explicit opt-out is respected', async t => {
  const db = await createTestDatabase(async (name, database) => {
    if (name === '202610160005_push_notifications.sql') await database.exec('create role service_role nologin;grant usage on schema public to service_role;');
  });
  t.after(() => db.close());
  await createTestUser(db, fresh, 'energia_padrao'); await createTestUser(db, optedOut, 'energia_desligada');
  // Conta que nunca escolheu: ao permitir notificações no Android, o aparelho é registrado com o aviso de energia.
  await databaseRpc(db, fresh, 'learning_push_register', { p_token: tokenA });
  const row = (await db.query<{ energy: boolean; comeback: boolean }>('select energy,comeback from push_preferences where user_id=$1', [fresh])).rows[0]!;
  assert.deepEqual(row, { energy: true, comeback: false });
  assert.equal((await db.query('select 1 from push_devices where user_id=$1', [fresh])).rows.length, 1);
  // Conta que desligou tudo: continua sem registro e sem avisos.
  await databaseRpc(db, optedOut, 'learning_push_preferences', { p_energy: false, p_comeback: false });
  await assert.rejects(databaseRpc(db, optedOut, 'learning_push_register', { p_token: tokenB }), /push_consent_required/);
  assert.deepEqual(await databaseRpc(db, optedOut, 'learning_push_preferences'), { energy: false, comeback: false, timezone: 'America/Sao_Paulo' });
});
