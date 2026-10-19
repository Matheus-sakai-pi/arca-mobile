import { createHash } from 'node:crypto';
import { test, expect } from './fixtures.ts';
import { capture } from './actions.ts';

test('paid VIP previews, saves and reloads profile styling while cancel discards changes', async ({ page, context, backend }, info) => {
  const account = createHash('sha256').update(backend.owner).digest('hex');
  await backend.db.query("select store_play_subscription($1,$2,$3,'arca_vip','mensal','SUBSCRIPTION_STATE_ACTIVE',now()+interval '30 days',now(),true)", [backend.owner, 'visual-' + backend.owner, account]);
  await backend.install(context);
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Personalizar perfil', exact: true }).click();
  const picker = page.getByTestId('profile-appearance-picker');
  await picker.getByRole('radio', { name: 'Moldura Dourada', exact: true }).click();
  await picker.getByRole('radio', { name: 'Fundo Jardim', exact: true }).click();
  await expect(page.getByTestId('profile-appearance-preview').getByTestId('profile-frame-gold')).toBeVisible();
  await capture(page, info, 'appearance-preview');
  await picker.getByRole('button', { name: 'Salvar personalização', exact: true }).click();
  await expect(picker).toHaveCount(0);
  const identity = page.getByTestId('profile-identity');
  await expect(identity.getByTestId('profile-cover-garden')).toBeVisible();
  await expect(identity.getByTestId('profile-frame-gold')).toBeVisible();
  await expect(identity.getByTestId('profile-vip-badge')).toBeVisible();
  await page.reload();
  await expect(identity.getByTestId('profile-cover-garden')).toBeVisible();
  await capture(page, info, 'appearance-saved');
  await page.getByRole('button', { name: 'Personalizar perfil', exact: true }).click();
  await picker.getByRole('radio', { name: 'Fundo Constelação', exact: true }).click();
  await picker.getByRole('button', { name: 'Fechar personalização', exact: true }).click();
  await expect(identity.getByTestId('profile-cover-garden')).toBeVisible();
  await expect(identity.getByTestId('profile-cover-stars')).toHaveCount(0);
  await page.getByRole('button', { name: 'Personalizar perfil', exact: true }).click();
  await picker.getByRole('switch', { name: 'Mostrar selo VIP', exact: true }).click();
  await picker.getByRole('button', { name: 'Salvar personalização', exact: true }).click();
  await expect(identity.getByTestId('profile-vip-badge')).toHaveCount(0);
});

test('non-VIP may preview but cannot apply exclusive styling, including referral battery recipients', async ({ page, context, backend }, info) => {
  await backend.db.query("insert into referral_benefits values($1,now()+interval '3 days')", [backend.owner]);
  await backend.install(context);
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Personalizar perfil', exact: true }).click();
  const picker = page.getByTestId('profile-appearance-picker');
  await picker.getByRole('radio', { name: 'Moldura Estelar', exact: true }).click();
  await picker.getByRole('radio', { name: 'Fundo Constelação', exact: true }).click();
  await capture(page, info, 'appearance-vip-preview-locked');
  await expect(page.getByTestId('profile-identity').getByTestId('profile-frame-classic')).toBeAttached();
  await picker.getByRole('button', { name: 'Conhecer Arca VIP', exact: true }).click();
  await expect(page).toHaveURL(/\/vip$/);
  expect((await backend.db.query('select * from profile_appearance where user_id=$1', [backend.owner])).rows).toHaveLength(0);
});

test('failed style saves remain retryable and do not change the visible profile', async ({ page, context, backend }) => {
  const account = createHash('sha256').update(backend.owner).digest('hex');
  await backend.db.query("select store_play_subscription($1,$2,$3,'arca_vip','anual','SUBSCRIPTION_STATE_ACTIVE',now()+interval '1 year',now(),true)", [backend.owner, 'visual-retry-' + backend.owner, account]);
  await backend.install(context);
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Personalizar perfil', exact: true }).click();
  const picker = page.getByTestId('profile-appearance-picker');
  await picker.getByRole('radio', { name: 'Moldura Oliveira', exact: true }).click();
  await picker.getByRole('radio', { name: 'Fundo Céu', exact: true }).click();
  backend.failNext('learning_profile_appearance');
  await picker.getByRole('button', { name: 'Salvar personalização', exact: true }).click();
  await expect(picker.getByText(/Não foi possível salvar ou carregar/)).toBeVisible();
  await expect(page.getByTestId('profile-identity').getByTestId('profile-frame-classic')).toBeAttached();
  await picker.getByRole('button', { name: 'Salvar personalização', exact: true }).click();
  await expect(picker).toHaveCount(0);
  await expect(page.getByTestId('profile-identity').getByTestId('profile-frame-laurel')).toBeVisible();
});

test('retrying a failed load restores the saved selection instead of overwriting it with defaults', async ({ page, context, backend }) => {
  const account = createHash('sha256').update(backend.owner).digest('hex');
  await backend.db.query("select store_play_subscription($1,$2,$3,'arca_vip','mensal','SUBSCRIPTION_STATE_ACTIVE',now()+interval '30 days',now(),true)", [backend.owner, 'visual-load-' + backend.owner, account]);
  await backend.rpc('learning_profile_appearance', { p_frame: 'gold', p_background: 'garden', p_badge: false });
  backend.failures.set('learning_profile_appearance', { remaining: 10, afterCommit: false });
  await backend.install(context);
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Personalizar perfil', exact: true }).click();
  const picker = page.getByTestId('profile-appearance-picker');
  await expect(picker.getByText(/Não foi possível carregar seu estilo/)).toBeVisible();
  backend.failures.clear();
  await picker.getByRole('button', { name: 'Tentar carregar novamente', exact: true }).click();
  await expect(picker.getByRole('radio', { name: 'Moldura Dourada', exact: true })).toHaveAttribute('aria-checked', 'true');
  await expect(picker.getByRole('radio', { name: 'Fundo Jardim', exact: true })).toHaveAttribute('aria-checked', 'true');
  await expect(picker.getByRole('switch', { name: 'Mostrar selo VIP', exact: true })).not.toBeChecked();
  await picker.getByRole('button', { name: 'Salvar personalização', exact: true }).click();
  await expect(picker).toHaveCount(0);
  await expect(page.getByTestId('profile-identity').getByTestId('profile-frame-gold')).toBeVisible();
});
