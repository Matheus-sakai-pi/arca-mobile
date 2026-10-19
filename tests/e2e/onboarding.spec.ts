import { test, expect, type TestBackend } from './fixtures';
import type { BrowserContext, Page } from '@playwright/test';
import { capture } from './actions';

async function freshEntry(page: Page, context: BrowserContext, backend: TestBackend) {
  await backend.install(context, true);
  await page.goto('/');
  await page.evaluate(() => { localStorage.clear(); sessionStorage.setItem('arca.e2e.initialized', 'yes'); });
  await page.reload();
  await expect(page.getByTestId('onboarding-welcome')).toBeVisible();
}

test('onboarding offers safe practice, retry, back, energy explanation and persistent guest entry', async ({ page, context, backend }, info) => {
  await freshEntry(page, context, backend);
  await capture(page, info, 'onboarding-welcome');
  await page.getByRole('button', { name: 'Experimentar', exact: true }).click();
  const verify = page.getByRole('button', { name: 'Conferir resposta', exact: true });
  await expect(verify).toBeDisabled();
  await page.getByRole('radio', { name: 'Gênesis', exact: true }).click();
  await verify.click();
  await expect(page.getByTestId('onboarding-feedback')).toContainText('Tudo bem aprender tentando.');
  await capture(page, info, 'onboarding-feedback');
  await page.getByRole('button', { name: 'Tentar de novo', exact: true }).click();
  await expect(verify).toBeDisabled();
  await page.getByRole('radio', { name: 'Mateus', exact: true }).click();
  await verify.click();
  await expect(page.getByTestId('onboarding-feedback')).toContainText('Isso mesmo!');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByTestId('onboarding-step')).toHaveText('3 de 4');
  await expect(page.getByText('Recupere 1 a cada 48min, até o máximo de 30.', { exact: true })).toBeVisible();
  await capture(page, info, 'onboarding-energy');
  await page.getByRole('button', { name: 'Voltar uma etapa', exact: true }).click();
  await expect(page.getByTestId('onboarding-feedback')).toContainText('Sua resposta: Mateus');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByTestId('onboarding-ready')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('arca.onboarding.v1'))).toBeNull();
  await capture(page, info, 'onboarding-ready');
  expect(backend.calls.filter(call => ['learning_energy_begin', 'start_learning_lesson', 'complete_learning_lesson', 'record_study_session'].includes(call.name) || call.name === 'learning_battery' && call.body.p_action === 'answer')).toHaveLength(0);
  expect((await backend.db.query('select * from lesson_attempts where user_id=$1', [backend.owner])).rows).toHaveLength(0);
  await page.getByRole('button', { name: 'Continuar sem conta', exact: true }).click();
  await expect(page.getByTestId('unit-card-conhecendo-a-biblia')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('arca.onboarding.v1'))).toBe('done');
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Abrir meu perfil' })).toBeVisible();
  await expect(page.getByTestId('onboarding-welcome')).toHaveCount(0);
});

test('onboarding skips to a choice and finishes only when signup or login is chosen', async ({ page, context, backend }) => {
  await freshEntry(page, context, backend);
  await page.getByRole('button', { name: 'Pular apresentação', exact: true }).click();
  await expect(page.getByTestId('onboarding-ready')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('arca.onboarding.v1'))).toBeNull();
  await page.getByRole('button', { name: 'Criar minha conta', exact: true }).click();
  await expect(page.getByLabel('Nome de usuário', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('arca.onboarding.v1'))).toBe('done');
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
  await expect(page.getByTestId('onboarding-welcome')).toHaveCount(0);
});

test('onboarding lets returning users enter directly and does not reset existing completion', async ({ page, context, backend }) => {
  await backend.install(context);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Abrir meu perfil' })).toBeVisible();
  await expect(page.getByTestId('onboarding-welcome')).toHaveCount(0);
  await page.evaluate(() => localStorage.removeItem('sb-arca-e2e-auth-token'));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
  await page.goto('/onboarding');
  await page.getByRole('button', { name: 'Já tenho uma conta', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
});

test('onboarding remains usable if completion storage is restricted', async ({ page, context, backend }) => {
  await freshEntry(page, context, backend);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === 'arca.onboarding.v1') throw new DOMException('Storage blocked', 'SecurityError');
      original.call(this, key, value);
    };
  });
  await page.getByRole('button', { name: 'Pular apresentação', exact: true }).click();
  await page.getByRole('button', { name: 'Continuar sem conta', exact: true }).click();
  await expect(page.getByTestId('unit-card-conhecendo-a-biblia')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('arca.onboarding.v1'))).toBeNull();
});
