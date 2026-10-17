import { test, expect } from './fixtures';
import { initialUnit } from '../../src/data/lessons.ts';
import { wrongAnswer } from '../learningFixtures.ts';
import { capture, chooseAnswer, verifyAnswer } from './actions';
const lesson = initialUnit.lessons[0]!;

for (const guest of [false, true]) test(`${guest ? 'guest' : 'account'} battery costs one per answer, is visible beside progress and cannot refill from the device clock`, async ({ page, context, backend }, info) => {
  await backend.db.exec('update learning_energy_config set enabled=true,rollout=100');
  await backend.install(context, guest);
  await page.goto(`/lesson/${lesson.id}`);
  const meter = page.getByTestId('lesson-energy-meter');
  await expect(meter).toHaveAccessibleName('30 de 30 energias');
  await expect(meter.getByTestId('battery-icon')).toBeVisible();
  const meterBox = await meter.boundingBox(), progress = await page.getByRole('progressbar', { name: 'Progresso da lição' }).boundingBox();
  expect(meterBox!.x).toBeGreaterThanOrEqual(progress!.x + progress!.width);
  await capture(page, info, guest ? 'guest-battery' : 'lesson-battery');
  await verifyAnswer(page, lesson.questions[0]!, wrongAnswer(lesson.questions[0]!));
  await verifyAnswer(page, lesson.questions[1]!);
  await expect(meter).toHaveAccessibleName('28 de 30 energias');
  // Stay inside the test login lifetime while jumping past many refill intervals.
  await page.evaluate(() => { const now = Date.now(); Date.now = () => now + 12 * 3600000; });
  await meter.click();
  await expect(page.getByTestId('energy-details')).toContainText('28 de 30 energias');
  await page.getByRole('button', { name: 'Fechar energia', exact: true }).click();
  await page.reload();
  await expect(meter).toHaveAccessibleName('28 de 30 energias');
  const cost = (await backend.db.query<{ total: number }>("select sum((receipt->>'charged')::integer)::integer total from battery_events")).rows[0]!.total;
  expect(cost).toBe(2);
});

test('lost receipts retry once; exhaustion saves the selected answer and resumes after a server refill', async ({ page, context, backend }, info) => {
  await backend.db.exec('update learning_energy_config set enabled=true,rollout=100');
  await backend.install(context);
  await page.goto('/learn');
  await expect(page.getByTestId('energy-meter')).toHaveAccessibleName('30 de 30 energias');
  await backend.db.query("update battery_wallets set balance=2,refill_at=now()+interval '1 hour' where user_id=$1", [backend.owner]);
  await page.goto(`/lesson/${lesson.id}`);
  await expect(page.getByRole('heading', { name: 'Sua bateria pode não ser suficiente', exact: true })).toBeVisible();
  await capture(page, info, 'low-battery-warning');
  await page.getByRole('button', { name: 'Começar mesmo assim', exact: true }).click();
  await chooseAnswer(page, lesson.questions[0]!, wrongAnswer(lesson.questions[0]!));
  backend.failNext('learning_battery', true, 'answer');
  await page.getByRole('button', { name: 'Verificar', exact: true }).click();
  await expect(page.getByText('Conecte-se para confirmar a energia e continuar. Sua resposta continua guardada.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Verificar', exact: true }).click();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByTestId('lesson-energy-meter')).toHaveAccessibleName('1 de 30 energias');
  await verifyAnswer(page, lesson.questions[1]!, wrongAnswer(lesson.questions[1]!));
  const third = lesson.questions[2]!;
  await chooseAnswer(page, third, third.correctAnswer);
  await page.getByRole('button', { name: 'Verificar', exact: true }).click();
  await expect(page.getByTestId('battery-exhausted')).toBeVisible();
  await capture(page, info, 'empty-battery');
  await page.getByRole('button', { name: 'Salvar e sair', exact: true }).click();
  await page.getByTestId(`unit-card-${lesson.unitId}`).click();
  await page.getByRole('button', { name: `${lesson.title}, Disponível`, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Hora de recarregar', exact: true })).toBeVisible();
  await backend.db.query("update battery_wallets set refill_at=now()-interval '1 second' where user_id=$1", [backend.owner]);
  await page.getByRole('button', { name: 'Atualizar bateria', exact: true }).click();
  await page.getByRole('button', { name: 'Começar mesmo assim', exact: true }).click();
  await expect(page.getByText('Exercício 3/10', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Verificar', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Verificar', exact: true }).click();
  expect((await backend.db.query('select * from battery_events')).rows).toHaveLength(3);
  expect((await backend.db.query<{ balance: number }>('select balance from battery_wallets where user_id=$1', [backend.owner])).rows[0]!.balance).toBe(0);
});

test('end-of-lesson mistake corrections are free at zero battery and still finish with real XP', async ({ page, context, backend }, info) => {
  await backend.db.exec('update learning_energy_config set enabled=true,rollout=100');
  await backend.install(context);
  await page.goto(`/lesson/${lesson.id}`);
  for (const [index, q] of lesson.questions.entries()) await verifyAnswer(page, q, index === 0 ? wrongAnswer(q) : q.correctAnswer);
  await expect(page.getByText('Revisão · 1 pendente', { exact: true })).toBeVisible();
  await backend.db.query("update battery_wallets set balance=0,refill_at=now()+interval '1 hour' where user_id=$1", [backend.owner]);
  await page.getByTestId('lesson-energy-meter').click();
  await expect(page.getByTestId('energy-details')).toContainText('0 de 30 energias');
  await page.getByRole('button', { name: 'Fechar energia', exact: true }).click();
  await chooseAnswer(page, lesson.questions[0]!, lesson.questions[0]!.correctAnswer);
  await page.getByRole('button', { name: 'Verificar', exact: true }).click();
  await expect(page.getByTestId('battery-exhausted')).toBeHidden();
  await capture(page, info, 'free-mistake-correction');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Lição concluída!', exact: true })).toBeVisible();
  expect((await backend.db.query<{ cost: number }>("select (receipt->>'charged')::integer cost from battery_events order by turn desc limit 1")).rows[0]!.cost).toBe(0);
  expect((await backend.db.query("select * from battery_rewards where reward_key='perfect'")).rows).toHaveLength(0);
});

test('streak and perfect rewards animate actual capped gains without replaying after reload', async ({ page, context, backend }, info) => {
  await backend.db.exec('update learning_energy_config set enabled=true,rollout=100');
  await backend.install(context);
  await page.goto(`/lesson/${lesson.id}`);
  for (const q of lesson.questions.slice(0, 4)) await verifyAnswer(page, q);
  await chooseAnswer(page, lesson.questions[4]!, lesson.questions[4]!.correctAnswer);
  await page.getByRole('button', { name: 'Verificar', exact: true }).click();
  await expect(page.getByTestId('battery-bonus')).toContainText('+5 energias');
  await expect(page.getByTestId('lesson-energy-meter')).toHaveAccessibleName('30 de 30 energias');
  await capture(page, info, 'streak-battery-bonus');
  await page.reload();
  await expect(page.getByTestId('battery-bonus')).toHaveCount(0);
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  for (const q of lesson.questions.slice(5, 9)) await verifyAnswer(page, q);
  await chooseAnswer(page, lesson.questions[9]!, lesson.questions[9]!.correctAnswer);
  await page.getByRole('button', { name: 'Verificar', exact: true }).click();
  await expect(page.getByTestId('battery-bonus')).toContainText('lição perfeita');
  await expect(page.getByTestId('lesson-energy-meter')).toHaveAccessibleName('30 de 30 energias');
  await capture(page, info, 'perfect-battery-bonus');
  expect((await backend.db.query('select * from battery_rewards')).rows).toHaveLength(3);
});

test('offline answer confirmation never advances or spends provisionally and recovers the saved selection', async ({ page, context, backend }) => {
  await backend.db.exec('update learning_energy_config set enabled=true,rollout=100');
  await backend.install(context);
  await page.goto(`/lesson/${lesson.id}`);
  await chooseAnswer(page, lesson.questions[0]!, lesson.questions[0]!.correctAnswer);
  // Explicitly abort the RPC as well: route.fulfill in the SQL test backend can bypass Chromium's offline emulation.
  await page.route('**/rest/v1/rpc/learning_battery', route => route.abort('internetdisconnected'));
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Verificar', exact: true }).click();
  await expect(page.getByText('Conecte-se para confirmar a energia e continuar. Sua resposta continua guardada.', { exact: true })).toBeVisible();
  await expect(page.getByText('Exercício 1/10', { exact: true })).toBeVisible();
  expect((await backend.db.query('select * from battery_events')).rows).toHaveLength(0);
  await context.setOffline(false);
  await page.unroute('**/rest/v1/rpc/learning_battery');
  await page.getByRole('button', { name: 'Verificar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Continuar', exact: true })).toBeVisible();
  expect((await backend.db.query('select * from battery_events')).rows).toHaveLength(1);
});
