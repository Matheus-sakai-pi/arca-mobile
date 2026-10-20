import { test, expect } from './fixtures';
import { initialUnit } from '../../src/data/lessons.ts';
import { capture, chooseAnswer } from './actions';

test('lessons stay usable without panorama banners or image expansion controls', async ({ page, context, backend }, info) => {
  await backend.install(context);
  const lesson = initialUnit.lessons[0]!;
  await page.goto(`/lesson/${lesson.id}`);
  await chooseAnswer(page, lesson.questions[0]!, lesson.questions[0]!.correctAnswer);
  await expect(page.getByTestId(/^chapter-scene-/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Ampliar ilustração:/ })).toHaveCount(0);
  await expect(page.getByRole('radio', { name: 'Uma coleção de livros', exact: true })).toBeChecked();
  await capture(page, info, 'exercise-without-panorama');
  await page.getByRole('button', { name: 'Verificar', exact: true }).click();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByTestId(/^chapter-scene-/)).toHaveCount(0);
  expect((await backend.db.query<{ xp_total: number }>('select xp_total from profiles where id=$1', [backend.owner])).rows[0]!.xp_total).toBe(0);
});

test('trail art and checkpoints show real halfway and finished progress', async ({ page, context, backend }, info) => {
  await backend.completeLessons(5); await backend.install(context);
  await page.goto('/learn');
  await expect(page.getByRole('heading', { name: /Unidade 1: Conhecendo a Bíblia/ })).toBeVisible();
  await expect(page.getByTestId(/^chapter-scene-/)).toHaveCount(0);
  const unitId = initialUnit.lessons[0]!.unitId;
  const checkpoint = page.getByTestId(`trail-chest-${unitId}`);
  await checkpoint.scrollIntoViewIfNeeded();
  await expect(checkpoint).toContainText('Metade do caminho');
  await expect(checkpoint).toContainText('5/10 lições concluídas');
  await expect(page.getByTestId(`trail-chest-art-${unitId}`)).toBeVisible();
  await capture(page, info, 'halfway-checkpoint');
  await backend.completeLessons(10); await page.reload();
  const trophy = page.getByTestId(`trail-trophy-${unitId}`);
  await trophy.scrollIntoViewIfNeeded();
  await expect(trophy).toContainText('Unidade concluída');
  await expect(trophy).toContainText('10/10 lições concluídas');
  await capture(page, info, 'finished-checkpoint');
});

test('illustrated friends, challenges, history, reviews and energy remain usable at every viewport', async ({ page, context, backend }, info) => {
  await backend.install(context);
  for (const [route, art] of [['/friends', 'friends'], ['/challenges', 'challenge'], ['/study/history', 'history'], ['/study/review', 'review']]) {
    await page.goto(route!);
    const artwork = page.getByTestId(`visual-art-${art}`);
    await expect(artwork).toBeVisible();
    await expect.poll(() => artwork.locator('img').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
    await capture(page, info, `illustrated-${art}`);
  }
  await page.goto('/learn');
  await page.getByTestId('energy-meter').click();
  await expect(page.getByTestId('energy-details').getByTestId('visual-art-energy')).toBeVisible();
  await capture(page, info, 'illustrated-energy');
  await page.getByRole('button', { name: 'Fechar energia', exact: true }).click();
  await expect(page.getByTestId('energy-details')).toBeHidden();
});
