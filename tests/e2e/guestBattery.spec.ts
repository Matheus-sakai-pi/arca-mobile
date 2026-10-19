import { test, expect } from './fixtures';
import { initialUnit } from '../../src/data/lessons.ts';
import { chooseAnswer } from './actions';
import { guestBatteryKey, legacyGuestBatteryKey } from '../../src/lib/guestBattery';

test('a visitor from the old test backend recovers without losing the real wallet on reload', async ({ page, context, backend }) => {
  await backend.db.exec('update learning_energy_config set enabled=true,rollout=100');
  await backend.install(context, true);
  await context.addInitScript(({ key }) => { localStorage.setItem(key, 'a'.repeat(64)); }, { key: legacyGuestBatteryKey });
  const lesson = initialUnit.lessons[0]!;
  await page.goto(`/lesson/${lesson.id}`);
  const meter = page.getByTestId('lesson-energy-meter');
  await expect(meter).toHaveAccessibleName('30 de 30 energias');
  await chooseAnswer(page, lesson.questions[0]!, lesson.questions[0]!.correctAnswer);
  await page.getByRole('button', { name: 'Verificar', exact: true }).click();
  await expect(meter).toHaveAccessibleName('29 de 30 energias');
  await page.reload();
  await expect(meter).toHaveAccessibleName('29 de 30 energias');
  await expect(page.getByRole('button', { name: 'Continuar', exact: true })).toBeVisible();
  expect(backend.calls.filter(c => c.name === 'learning_battery' && c.body.p_action === 'register')).toHaveLength(1);
  expect((await backend.db.query('select * from battery_wallets where user_id is null')).rows).toHaveLength(1);
});

test('a temporary failure validates the same saved visitor wallet instead of refilling it', async ({ page, context, backend }) => {
  await backend.db.exec('update learning_energy_config set enabled=true,rollout=100');
  const wallet = await backend.rpc<{ guestToken: string }>('learning_battery', { p_action: 'register' }, null);
  await backend.db.exec("update battery_wallets set balance=7,refill_at=now()+interval '1 hour' where user_id is null");
  await backend.install(context, true);
  await context.addInitScript(({ key, token }) => { localStorage.setItem(key, token); }, { key: guestBatteryKey('https://arca-e2e.supabase.co'), token: wallet.guestToken });
  backend.failNext('learning_battery', false, 'status');
  await page.goto('/learn');
  await page.goto(`/lesson/${initialUnit.lessons[0]!.id}`);
  await expect(page.getByRole('heading', { name: 'Sua bateria pode não ser suficiente', exact: true })).toBeVisible();
  await expect(page.getByText('7 de 30 energias', { exact: true })).toBeVisible();
  expect(backend.calls.filter(c => c.name === 'learning_battery' && c.body.p_action === 'register')).toHaveLength(0);
});
