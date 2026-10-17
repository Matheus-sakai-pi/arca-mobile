import { test, expect } from './fixtures';
import { initialUnit } from '../../src/data/lessons.ts';
import { wrongAnswer } from '../learningFixtures.ts';
import { capture, verifyAnswer } from './actions';

test('guest enters through onboarding, corrects mistakes, reloads progress and reviews without extra XP', async ({ page, context, backend }, info) => {
  // Public entry is exercised without preloading a guest session or skipping onboarding.
  await backend.install(context, true);
  await page.goto('/');
  await page.evaluate(() => { localStorage.clear(); sessionStorage.setItem('arca.e2e.initialized', 'yes'); });
  await page.reload();
  await page.getByRole('button', { name: 'Já tenho uma conta', exact: true }).click();
  await page.getByRole('button', { name: 'Continuar sem conta', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Abrir meu perfil' })).toBeVisible();
  await page.goto('/learn');
  await page.getByTestId(`unit-card-${initialUnit.lessons[0]!.unitId}`).click();
  const first = initialUnit.lessons[0]!;
  await page.getByRole('button', { name: 'Antigo e Novo Testamento, Bloqueada', exact: true }).click();
  await expect(page.getByText('Conclua O que é a Bíblia? para liberar.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: `${first.title}, Disponível`, exact: true }).click();
  await expect(page.getByText('Exercício 1/10', { exact: true })).toBeVisible();
  for (const [index, question] of first.questions.entries()) {
    await verifyAnswer(page, question, index === 0 ? wrongAnswer(question) : question.correctAnswer);
  }
  await expect(page.getByText('Revisão · 1 pendente', { exact: true })).toBeVisible();
  await verifyAnswer(page, first.questions[0]!);
  await expect(page.getByRole('heading', { name: 'Lição concluída!', exact: true })).toBeVisible();
  await expect(page.getByText('28 XP no total', { exact: true })).toBeVisible();
  await capture(page, info, 'guest-result');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  const celebration = page.getByTestId('achievement-celebration');
  await expect(celebration).toBeVisible();
  await expect(celebration).toContainText('Primeiro Passo');
  await celebration.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(celebration).toBeHidden();
  await page.reload();
  await page.getByTestId(`unit-card-${first.unitId}`).click();
  await expect(page.getByRole('button', { name: /O que é a Bíblia\?, Concluída/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Antigo e Novo Testamento, Atual/ })).toBeVisible();
  await page.getByRole('button', { name: /O que é a Bíblia\?, Concluída/ }).click();
  for (const question of first.questions) await verifyAnswer(page, question);
  await expect(page.getByText('Revisão concluída. O XP desta lição já foi recebido.', { exact: true })).toBeVisible();
  await expect(page.getByText('28 XP no total', { exact: true })).toBeVisible();
  expect(backend.calls.filter(call => call.name === 'complete_learning_lesson')).toHaveLength(0);
});

test('authenticated lesson saves real SQL progress and restores it after reload', async ({ page, context, backend }, info) => {
  await backend.install(context);
  const first = initialUnit.lessons[0]!;
  await page.goto(`/lesson/${first.id}`);
  for (const question of first.questions) await verifyAnswer(page, question);
  await expect(page.getByText('35 XP no total', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('35 XP no total', { exact: true })).toBeVisible();
  const { rows } = await backend.db.query<{ xp_total: number }>('select xp_total from profiles where id=$1', [backend.owner]);
  expect(rows[0]!.xp_total).toBe(35);
  expect((await backend.db.query('select * from xp_events where user_id=$1', [backend.owner])).rows).toHaveLength(1);
  await capture(page, info, 'account-result');
});

test('optional reminder appears after third lesson only and dismissal persists', async ({ page, context, backend }, info) => {
  await backend.completeLessons(2); await backend.install(context);
  await page.goto('/lesson/result');
  await expect(page.getByRole('heading', { name: 'Lição concluída!', exact: true })).toBeVisible();
  // Wait beyond the intentional one-second invitation delay before asserting absence.
  await page.waitForTimeout(1300);
  await expect(page.getByTestId('study-reminder-prompt')).toBeHidden();
  await backend.completeLessons(3); await page.reload();
  await expect(page.getByTestId('study-reminder-prompt')).toBeVisible();
  await capture(page, info, 'third-lesson-invitation');
  await page.getByRole('button', { name: 'Agora não', exact: true }).click();
  await expect(page.getByTestId('study-reminder-prompt')).toBeHidden();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Lição concluída!', exact: true })).toBeVisible();
  await page.waitForTimeout(1300);
  await expect(page.getByTestId('study-reminder-prompt')).toBeHidden();
  expect(await page.evaluate(owner => localStorage.getItem(`arca.reminder-prompt.${owner}.v1`), backend.owner)).toBe('offered');
});

test('reminder invitation opens settings without enabling notifications on web', async ({ page, context, backend }) => {
  await backend.completeLessons(3); await backend.install(context);
  await page.goto('/lesson/result');
  await page.getByRole('button', { name: 'Escolher horário', exact: true }).click();
  await expect(page).toHaveURL(/\/study\/reminders$/);
  await expect(page.getByRole('switch', { name: 'Lembrete diário' })).toBeDisabled();
  await expect(page.getByText('Disponível no aplicativo Android e iOS. Nenhum lembrete é enviado pela prévia web.', { exact: true })).toBeVisible();
});
