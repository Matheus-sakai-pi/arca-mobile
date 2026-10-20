import { test, expect } from './fixtures';
import { learningUnits } from '../../src/data/lessons.ts';
import { capture } from './actions';

const unit = learningUnits[0]!;
test('chest awards 5-7 energy once, updates the header and survives a lost receipt and reload', async ({ page, context, backend }, info) => {
  await backend.completeLessons(5); await backend.install(context);
  await backend.rpc('learning_battery', { p_action: 'status' });
  await backend.db.query("update battery_wallets set balance=10,refill_at=now()+interval '1 hour' where user_id=$1", [backend.owner]);
  await page.goto('/learn');
  await page.getByTestId(`chest-open-${unit.id}`).click();
  const dialog = page.getByTestId('energy-chest-dialog');
  await expect(dialog).toContainText('5 a 7 energias');
  const claim = dialog.getByRole('button', { name: 'Abrir e receber energia', exact: true });
  await expect(claim).toBeEnabled();
  await capture(page, info, 'chest-ready');
  backend.failNext('learning_battery', true, 'chest_claim');
  await claim.click();
  await expect(dialog).toContainText('Não foi possível conferir o baú agora.');
  await claim.click();
  await expect(dialog.getByRole('heading', { name: 'Recompensa recebida!', exact: true })).toBeVisible();
  const rewards = (await backend.db.query<{ rolled: number; granted: number }>('select rolled,granted from battery_unit_chests')).rows;
  expect(rewards).toHaveLength(1);
  const reward = rewards[0]!;
  expect(reward.rolled).toBeGreaterThanOrEqual(5); expect(reward.rolled).toBeLessThanOrEqual(7);
  expect(reward.granted).toBe(reward.rolled);
  await expect(dialog.getByTestId('chest-reward-amount')).toHaveText(`+${reward.granted} energias`);
  await capture(page, info, 'chest-reward');
  await dialog.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByTestId('energy-meter')).toHaveAccessibleName(`${10 + reward.granted} de 30 energias`);
  await page.reload();
  await expect(page.getByTestId(`trail-chest-${unit.id}`)).toContainText('Baú resgatado');
  await page.getByTestId(`chest-open-${unit.id}`).click();
  await expect(dialog.getByTestId('chest-reward-amount')).toHaveText(`+${reward.granted} energias`);
  await expect(dialog.getByRole('button', { name: 'Abrir e receber energia', exact: true })).toHaveCount(0);
  expect((await backend.db.query('select * from battery_unit_chests')).rows).toHaveLength(1);
  expect((await backend.db.query<{ balance: number }>('select balance from battery_wallets where user_id=$1', [backend.owner])).rows[0]!.balance).toBe(10 + reward.granted);
});

test('locked and full-battery chests stay unspent; partial rewards show the capacity warning', async ({ page, context, backend }, info) => {
  await backend.install(context);
  await page.goto('/learn');
  await page.getByTestId(`chest-open-${unit.id}`).click();
  const dialog = page.getByTestId('energy-chest-dialog');
  await expect(dialog).toContainText('Conclua 5 lições desta unidade');
  await expect(dialog.getByRole('button', { name: 'Abrir e receber energia', exact: true })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Fechar baú', exact: true }).click();
  await backend.completeLessons(5); await page.reload();
  await page.getByTestId(`chest-open-${unit.id}`).click();
  await expect(dialog).toContainText('Sua bateria está cheia. O baú fica guardado para depois.');
  const claim = dialog.getByRole('button', { name: 'Abrir e receber energia', exact: true });
  await expect(claim).toBeDisabled();
  expect((await backend.db.query('select * from battery_unit_chests')).rows).toHaveLength(0);
  await backend.db.query("update battery_wallets set balance=28,refill_at=now()+interval '1 hour' where user_id=$1", [backend.owner]);
  await dialog.getByRole('button', { name: 'Atualizar baú', exact: true }).click();
  await expect(dialog).toContainText('Há espaço para 2; o excedente do sorteio não será acumulado.');
  await claim.click();
  await expect(dialog.getByTestId('chest-reward-amount')).toHaveText('+2 energias');
  await expect(dialog).toContainText('para respeitar a capacidade da bateria.');
  await capture(page, info, 'chest-capacity-warning');
});

test('an unavailable chest service never grants energy or changes an existing wallet', async ({ page, context, backend }) => {
  await backend.completeLessons(5); await backend.install(context);
  await page.route('**/rest/v1/rpc/learning_battery', async route => {
    if (String(route.request().postDataJSON()?.p_action).startsWith('chest_')) await route.fulfill({ status: 400, json: { code: 'P0001', message: 'battery_action_invalid' } });
    else await route.fallback();
  });
  await page.goto('/learn');
  await page.getByTestId(`chest-open-${unit.id}`).click();
  const dialog = page.getByTestId('energy-chest-dialog');
  await expect(dialog).toContainText('As recompensas do baú ainda precisam ser ativadas no servidor. Seu baú não foi gasto.');
  await expect(dialog.getByRole('button', { name: 'Abrir e receber energia', exact: true })).toHaveCount(0);
  await expect(page.getByTestId('energy-meter')).toHaveAccessibleName('30 de 30 energias');
  expect((await backend.db.query('select * from battery_unit_chests')).rows).toHaveLength(0);
});
