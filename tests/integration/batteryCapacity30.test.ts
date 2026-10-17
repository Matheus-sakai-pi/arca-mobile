import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { createTestDatabase, createTestUser } from '../helpers/database.ts';

// Simula um banco que já estava com a bateria de 25 e aplica a migration do limite 30.
test('migration 30: full wallets reach 30, partial wallets keep balance and refill', async t => {
  const db = await createTestDatabase(undefined, { energyEnabled: true, through: '202610170003_unit_chest_energy.sql' }); t.after(() => db.close());
  const full = '00000000-0000-4000-8000-000000000901', partial = '00000000-0000-4000-8000-000000000902';
  await createTestUser(db, full, 'bateria_cheia'); await createTestUser(db, partial, 'bateria_meio');
  await db.exec(`update public.battery_rules set rules=jsonb_set(jsonb_set(rules,'{capacity}','25'),'{refillSeconds}','3456') where singleton`);
  await db.query('insert into public.battery_wallets(user_id,balance,refill_at) values($1,25,null),($2,10,now()+interval \'20 minutes\')', [full, partial]);
  await db.exec(await readFile(new URL('../../supabase/migrations/202610180001_battery_capacity_30.sql', import.meta.url), 'utf8'));
  const rules = (await db.query<{ rules: { capacity: number; refillSeconds: number } }>('select rules from public.battery_rules where singleton')).rows[0]!.rules;
  assert.equal(rules.capacity, 30); assert.equal(rules.refillSeconds, 2880);
  const wallets = (await db.query<{ user_id: string; balance: number; refill_at: string | null }>('select user_id,balance,refill_at from public.battery_wallets where user_id in ($1,$2)', [full, partial])).rows;
  const byUser = Object.fromEntries(wallets.map(w => [w.user_id, w]));
  assert.equal(byUser[full]!.balance, 30); assert.equal(byUser[full]!.refill_at, null);
  assert.equal(byUser[partial]!.balance, 10); assert.notEqual(byUser[partial]!.refill_at, null);
});
