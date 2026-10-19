import { createHash } from 'node:crypto';
import { test, expect } from './fixtures.ts';
import { capture, chooseAnswer } from './actions.ts';
import { initialUnit } from '../../src/data/lessons.ts';

test('profile exposes VIP and invitation screens without enabling web payments', async ({ page, context, backend }, info) => {
  await backend.install(context);
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Arca VIP', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Arca VIP', exact: true })).toBeVisible();
  await expect(page.getByTestId('vip-comparison')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Disponível no Android', exact: true })).toBeInViewport();
  await expect(page.getByText(/Nenhuma compra é realizada nesta prévia/)).toBeVisible();
  await capture(page, info, 'vip');
  const monthly = page.getByRole('radio', { name: 'Plano Mensal', exact: true });
  const yearly = page.getByRole('radio', { name: 'Plano Anual', exact: true });
  await expect(monthly).toContainText('R$ 19,90'); await expect(yearly).toContainText('R$ 99,90');
  await expect(yearly).toContainText('R$ 8,33 por mês · cobrado por ano');
  await expect(yearly).toContainText('ECONOMIZE 58%');
  await monthly.click(); await expect(monthly).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText('R$ 19,90/mês · renovação automática', { exact: true })).toBeVisible();
  await yearly.click(); await expect(yearly).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText('R$ 99,90/ano · renovação automática', { exact: true })).toBeVisible();
  await capture(page, info, 'vip-planos');
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  await page.getByRole('button', { name: 'Convide e ganhe bateria', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Convidar pelo WhatsApp' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Convidar pelo WhatsApp' })).toBeInViewport();
  await expect(page.getByText(/Seu código: [A-F0-9]{16}/)).toBeVisible();
  await expect(page.getByText('de bateria infinita para cada um', { exact: true })).toBeVisible();
  await expect(page.getByText('Vocês dois recebem 3 dias de bateria infinita.', { exact: true })).toBeVisible();
  await capture(page, info, 'invite');
});

test('invitation code copies only the code and handles clipboard failure without false success', async ({ page, context, backend }, info) => {
  await backend.install(context);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/invite');
  const codeText = page.getByText(/Seu código: [A-F0-9]{16}/);
  await expect(codeText).toBeVisible();
  const code = (await codeText.innerText()).replace('Seu código: ', '').trim();
  const copy = page.getByRole('button', { name: 'Copiar código', exact: true });
  await copy.click();
  await expect(page.getByText('Código copiado!', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(code);
  await capture(page, info, 'invite-copied');
  await page.evaluate(() => {
    navigator.clipboard.writeText = async () => { throw new Error('test_clipboard_denied'); };
    document.execCommand = () => false;
  });
  await copy.click();
  await expect(page.getByText('Não foi possível copiar. Selecione o código para copiar manualmente.', { exact: true })).toBeVisible();
  await expect(page.getByText('Código copiado!', { exact: true })).toHaveCount(0);
  await expect(codeText).toHaveText('Seu código: ' + code);
  await capture(page, info, 'invite-copy-error');
});

test('empty battery offers both options while preserving the lesson draft', async ({ page, context, backend }, info) => {
  await backend.install(context);
  await backend.db.exec('update learning_energy_config set enabled=true,rollout=100');
  await backend.rpc('learning_battery');
  await backend.db.query("update battery_wallets set balance=0,refill_at=now()+interval '1 hour' where user_id=$1", [backend.owner]);
  await page.goto(`/lesson/${initialUnit.lessons[0]!.id}`);
  await expect(page.getByText('Hora de recarregar', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Bateria infinita com Arca VIP' })).toBeVisible();
  await capture(page, info, 'empty-battery-options');
  await page.getByRole('button', { name: 'Convidar amigo pelo WhatsApp' }).click();
  await expect(page.getByText('Melhor com amigos', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  await expect(page.getByText('Hora de recarregar', { exact: true })).toBeVisible();
});

test('verified VIP answers with an empty wallet and displays unlimited battery inside the lesson', async ({ page, context, backend }) => {
  await backend.install(context);
  await backend.db.exec('update learning_energy_config set enabled=true,rollout=100');
  const account = createHash('sha256').update(backend.owner).digest('hex');
  await backend.db.query("select store_play_subscription($1,$2,$3,'arca_vip','mensal','SUBSCRIPTION_STATE_ACTIVE',now()+interval '30 days',now(),true)", [backend.owner, `e2e-${backend.owner}`, account]);
  await backend.rpc('learning_battery');
  await backend.db.query("update battery_wallets set balance=0,refill_at=now()+interval '1 hour' where user_id=$1", [backend.owner]);
  const lesson = initialUnit.lessons[0]!;
  await page.goto(`/lesson/${lesson.id}`);
  await expect(page.getByRole('button', { name: 'Bateria infinita', exact: true })).toBeVisible();
  await chooseAnswer(page, lesson.questions[0]!, lesson.questions[0]!.correctAnswer);
  await page.getByRole('button', { name: 'Verificar', exact: true }).click();
  await expect(page.getByText('Correto!', { exact: true })).toBeVisible();
  const receipt = await backend.db.query<{ charged: number }>("select (receipt->>'charged')::integer charged from battery_events");
  expect(receipt.rows[0]!.charged).toBe(0);
});

test('a new VIP sees the welcome once with its benefits; an account that was already VIP does not', async ({ page, context, backend }, info) => {
  await backend.install(context);
  // Conta vista antes como gratuita (o app grava isso na primeira abertura sem VIP).
  await context.addInitScript(owner => {
    const key = `arca.vip-welcome.${owner}.v1`;
    if (!localStorage.getItem(key)) localStorage.setItem(key, 'false');
  }, backend.owner);
  const account = createHash('sha256').update(backend.owner).digest('hex');
  await backend.db.query("select store_play_subscription($1,$2,$3,'arca_vip','mensal','SUBSCRIPTION_STATE_ACTIVE',now()+interval '30 days',now(),true)", [backend.owner, `e2e-${backend.owner}`, account]);
  await page.goto('/home');
  const welcome = page.getByTestId('vip-welcome');
  await expect(welcome.getByRole('heading', { name: 'Bem-vindo ao Arca VIP!', exact: true })).toBeVisible();
  await expect(welcome).toContainText('Bateria ilimitada');
  await expect(welcome).toContainText('Foto de perfil');
  await capture(page, info, 'vip-welcome');
  await welcome.getByRole('button', { name: 'Personalizar meu perfil', exact: true }).click();
  await expect(welcome).toHaveCount(0);
  await expect(page).toHaveURL(/\/profile$/);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Personalizar perfil', exact: true })).toBeVisible();
  await expect(page.getByTestId('vip-welcome')).toHaveCount(0);
});

test('an account that was already VIP before this version opens without the welcome', async ({ page, context, backend }) => {
  await backend.install(context);
  const account = createHash('sha256').update(backend.owner).digest('hex');
  await backend.db.query("select store_play_subscription($1,$2,$3,'arca_vip','mensal','SUBSCRIPTION_STATE_ACTIVE',now()+interval '30 days',now(),true)", [backend.owner, `e2e-${backend.owner}`, account]);
  await page.goto('/home');
  await expect(page.getByTestId('home-brand-logo')).toBeVisible();
  await expect.poll(() => page.evaluate(owner => localStorage.getItem(`arca.vip-welcome.${owner}.v1`), backend.owner)).toBe('true');
  await expect(page.getByTestId('vip-welcome')).toHaveCount(0);
});

test('ranking shows the VIP frame and a VIP tag under the podium avatar without squeezing the name', async ({ page, context, backend }, info) => {
  await backend.completeLessons(1); await backend.install(context);
  const account = createHash('sha256').update(backend.owner).digest('hex');
  await backend.db.query("select store_play_subscription($1,$2,$3,'arca_vip','mensal','SUBSCRIPTION_STATE_ACTIVE',now()+interval '30 days',now(),true)", [backend.owner, `e2e-${backend.owner}`, account]);
  await backend.db.query("insert into profile_appearance(user_id,frame_key,background_key,show_badge) values($1,'gold','garden',true)", [backend.owner]);
  await page.goto('/ranking');
  const podium = page.getByTestId('leaderboard-podium');
  await expect(podium.getByTestId('profile-frame-gold')).toBeVisible();
  await expect(podium.getByTestId('profile-vip-badge')).toBeVisible();
  await expect(podium.getByLabel(/Arca VIP/).first()).toBeVisible();
  await capture(page, info, 'ranking-vip');
});
