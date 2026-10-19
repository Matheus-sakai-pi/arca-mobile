import { test, expect } from './fixtures';
import { initialUnit } from '../../src/data/lessons.ts';
import { wrongAnswer } from '../learningFixtures.ts';
import { capture, chooseAnswer } from './actions';

test('compact units retain their own illustrations and open the clean cartoon trail', async ({ page, context, backend }, info) => {
  await backend.install(context);
  await page.goto('/learn');
  const card = page.getByTestId(`unit-card-${initialUnit.lessons[0]!.unitId}`);
  await expect(card).toBeVisible();
  const box = await card.boundingBox();
  expect(box!.height).toBeLessThan(270);
  const artwork = card.locator('img');
  await expect.poll(() => artwork.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  for (const unit of await page.locator('[data-testid^="unit-card-"]').all()) {
    const heading = await unit.getByRole('heading').boundingBox();
    const art = await unit.locator('img').boundingBox();
    expect(heading!.x + heading!.width).toBeLessThanOrEqual(art!.x);
    expect(await unit.getByRole('heading').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  }
  await capture(page, info, 'polished-units');
  await card.click();
  const trail = page.getByTestId('clean-unit-screen');
  await expect(trail).toBeVisible();
  await expect(page.getByTestId(`journey-start-${initialUnit.lessons[0]!.id}`)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continuar lição', exact: true })).toHaveCount(0);
  await capture(page, info, 'preserved-trail');
  await page.goto('/home');
  await expect(page.getByTestId('home-brand-logo')).toBeVisible();
  await capture(page, info, 'polished-home');
});

test('quiet exercise has distinct answer states, stable raised buttons and encouraging feedback', async ({ page, context, backend }, info) => {
  await backend.install(context);
  const lesson = initialUnit.lessons[0]!;
  await page.goto(`/lesson/${lesson.id}`);
  await expect(page.getByTestId('lesson-exercise')).toBeVisible();
  await expect(page.getByTestId('continuous-scene-screen')).toHaveCount(0);
  await expect(page.getByTestId('mascot-thinking')).toBeVisible();
  const verify = page.getByRole('button', { name: 'Verificar', exact: true });
  await expect(verify).toBeDisabled();
  const buttons = page.getByRole('radio');
  const first = await buttons.nth(0).boundingBox(), second = await buttons.nth(1).boundingBox();
  expect(second!.y - (first!.y + first!.height)).toBeGreaterThanOrEqual(8);
  await capture(page, info, 'quiet-exercise');
  await chooseAnswer(page, lesson.questions[0]!, wrongAnswer(lesson.questions[0]!));
  await expect(verify).toBeEnabled();
  const before = await verify.boundingBox();
  await page.mouse.move(before!.x + before!.width / 2, before!.y + before!.height / 2);
  await page.mouse.down();
  await expect(verify.getByTestId('button-face')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 4)');
  expect(await verify.boundingBox()).toEqual(before);
  await page.mouse.up();
  await expect(page.getByTestId('mascot-wrong_answer')).toBeVisible();
  await expect(page.getByTestId('lesson-feedback')).toContainText('Quase!');
  await expect(page.getByRole('radio', { name: /Uma coleção de livros, resposta correta/ })).toBeDisabled();
  await capture(page, info, 'encouraging-feedback');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByTestId('lesson-feedback')).toBeHidden();
  await chooseAnswer(page, lesson.questions[1]!, lesson.questions[1]!.correctAnswer);
  await verify.click();
  await expect(page.getByTestId('mascot-happy')).toBeVisible();
  await expect(page.getByTestId('lesson-feedback')).toContainText('Correto!');
});

test('result presents XP, statistics and real unit progress with reduced and full motion', async ({ page, context, backend }, info) => {
  await backend.completeLessons(1); await backend.install(context);
  await page.goto('/lesson/result');
  await expect(page.getByRole('heading', { name: 'Lição concluída!', exact: true })).toBeVisible();
  await expect(page.getByTestId('result-counters')).toContainText('XP conquistado');
  await expect(page.getByText('35 XP no total', { exact: true })).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Progresso da unidade concluída', exact: true })).toHaveAttribute('aria-valuenow', '10');
  await expect(page.getByTestId('visual-celebration')).toHaveCount(0);
  await capture(page, info, 'polished-result');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(owner => {
    const key = `arca.preferences.${owner}.v1`;
    localStorage.setItem(key, JSON.stringify({ ...JSON.parse(localStorage.getItem(key)!), reduceMotion: false }));
    // Escolha feita neste aparelho que ainda não chegou à conta: não pode ser desfeita pela cópia da conta.
    localStorage.setItem(`${key}.pending`, '1');
  }, backend.owner);
  await page.reload();
  await expect(page.getByText('35 XP no total', { exact: true })).toBeVisible();
  await expect(page.getByTestId('result-counters').getByLabel('+35 XP', { exact: true })).toBeVisible();
  await expect(page.getByTestId('result-details')).toHaveCSS('opacity', '1');
  await expect(page.getByTestId('visual-celebration')).toHaveCSS('pointer-events', 'none');
  await capture(page, info, 'result-motion');
});

test('empty search and recoverable error use the shared state treatment', async ({ page, context, backend }, info) => {
  await backend.install(context); await page.goto('/friends');
  await expect(page.getByTestId('empty-state')).toContainText('Você ainda não tem amizades aceitas.');
  await page.getByLabel('Buscar por usuário', { exact: true }).fill('nobody_here_999');
  await page.getByRole('button', { name: 'Buscar pessoas', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Nenhuma pessoa encontrada', exact: true })).toBeVisible();
  await capture(page, info, 'polished-empty-search');
  // Profile hydration can refresh the leaderboard a second time on entry.
  backend.failures.set('learning_leaderboard', { remaining: 5, afterCommit: false });
  await page.goto('/ranking');
  await expect(page.getByTestId('error-state')).toBeVisible();
  await capture(page, info, 'polished-error');
  backend.failures.delete('learning_leaderboard');
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await expect(page.getByTestId('error-state')).toBeHidden();
});
