import { test, expect } from './fixtures';
import { initialUnit, learningUnits } from '../../src/data/lessons.ts';
import { capture, verifyAnswer } from './actions';

const firstUnit = learningUnits[0]!, secondUnit = learningUnits[1]!;
test('cartoon coins show real completion, current and locked states and open only unlocked lessons', async ({ page, context, backend }, info) => {
  await backend.completeLessons(2); await backend.install(context);
  const [completed, , current, locked] = initialUnit.lessons;
  await page.goto('/learn');
  for (const [lesson, color] of [[completed!, 'rgb(9, 100, 255)'], [current!, 'rgb(9, 100, 255)'], [locked!, 'rgb(228, 230, 233)']] as const) {
    await expect(page.getByTestId(`journey-coin-face-${lesson.id}`)).toHaveCSS('background-color', color);
    const box = (await page.getByTestId(`journey-coin-${lesson.id}`).boundingBox())!;
    expect(box.width).toBe(96); expect(box.height).toBe(96);
  }
  await expect(page.getByTestId(`journey-start-${completed!.id}`)).toHaveCount(0);
  await expect(page.getByTestId(`journey-start-${current!.id}`)).toBeVisible();
  await expect(page.getByTestId(`journey-start-${locked!.id}`)).toHaveCount(0);
  await expect(page.getByRole('progressbar', { name: `Progresso de ${current!.title}`, exact: true })).toHaveAttribute('aria-valuenow', '0');
  await page.getByTestId(`journey-coin-${locked!.id}`).scrollIntoViewIfNeeded();
  await capture(page, info, 'clean-cartoon-trail');
  await page.getByRole('button', { name: `${locked!.title}, Bloqueada`, exact: true }).click();
  await expect(page.getByText(`Conclua ${current!.title} para liberar.`, { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/learn$/);
  await page.getByRole('button', { name: `${current!.title}, Atual`, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/lesson/${current!.id}`));
  expect((await backend.db.query('select * from lesson_attempts where user_id=$1', [backend.owner])).rows).toHaveLength(2);
});

test('the white journey keeps the masthead and the six icon tabs without scenery, mascot or footer CTA', async ({ page, context, backend }, info) => {
  await backend.install(context);
  await page.goto('/learn');
  await expect(page.getByTestId('current-lesson-scroll')).toBeVisible();
  await expect(page.getByLabel('Arca', { exact: true })).toBeVisible();
  await expect(page.getByTestId('learning-stats')).toBeVisible();
  await expect(page.getByTestId('energy-meter')).toBeVisible();
  await expect(page.getByTestId('continuous-scene-screen')).toHaveCount(0);
  await expect(page.locator('[data-testid^="mascot-"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Continuar lição', exact: true })).toHaveCount(0);
  for (const name of ['Início', 'Aprender', 'Ranking', 'Amigos', 'Conquistas', 'Perfil']) await expect(page.getByRole('tab', { name, exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Aprender', exact: true })).toHaveAttribute('aria-selected', 'true');
  await capture(page, info, 'trail-top');
  await page.getByRole('tab', { name: 'Perfil', exact: true }).click();
  await expect(page).toHaveURL(/\/profile$/);
});

test('current lesson ring restores forty percent from four mastered exercises after reload', async ({ page, context, backend }) => {
  await backend.install(context);
  const lesson = firstUnit.lessons[0]!;
  await page.goto(`/lesson/${lesson.id}`);
  for (const question of lesson.questions.slice(0, 4)) await verifyAnswer(page, question);
  await page.getByRole('button', { name: 'Sair da lição', exact: true }).click();
  await page.getByRole('button', { name: 'Salvar e sair', exact: true }).click();
  await page.goto('/learn');
  const ring = page.getByRole('progressbar', { name: `Progresso de ${lesson.title}`, exact: true });
  await expect(ring).toHaveAttribute('aria-valuenow', '40');
  const arc = page.getByTestId(`journey-progress-arc-${lesson.id}`);
  await expect(arc).toHaveAttribute('stroke', '#0964FF');
  expect(Number(await arc.getAttribute('stroke-dashoffset'))).toBeCloseTo(2 * Math.PI * 53 * 0.6);
  await page.reload();
  await expect(ring).toHaveAttribute('aria-valuenow', '40');
});

test('locked milestones reflect real progress and the single journey shows every unit in its own color', async ({ page, context, backend }, info) => {
  await backend.install(context);
  await page.goto('/learn');
  const chest = page.getByTestId(`trail-chest-${firstUnit.id}`), trophy = page.getByTestId(`trail-trophy-${firstUnit.id}`);
  await expect(chest).toHaveAccessibleName(/bloqueado, 0 de 10/);
  await expect(trophy).toHaveAccessibleName(/bloqueado, 0 de 10/);
  await expect(page.getByTestId(`trail-chest-art-${firstUnit.id}`).locator('rect').first()).toHaveAttribute('fill', '#A9B1BC');
  await backend.completeLessons(5); await page.reload();
  await expect(chest).toHaveAccessibleName(/desbloqueado, 5 de 10/);
  await expect(trophy).toHaveAccessibleName(/bloqueado, 5 de 10/);
  await backend.completeLessons(11); await page.reload();
  await expect(trophy).toHaveAccessibleName(/desbloqueado, 10 de 10/);
  // Trilha única: todas as unidades, cada uma com a faixa e as moedas na sua cor.
  await expect(page.locator('[data-testid^="trail-section-"]')).toHaveCount(learningUnits.length);
  await expect(page.locator('[data-testid^="journey-coin-face-"]')).toHaveCount(learningUnits.reduce((sum, unit) => sum + unit.lessons.length, 0));
  await expect(page.getByTestId(`unit-banner-${firstUnit.id}`)).toHaveCSS('background-color', 'rgb(9, 100, 255)');
  await expect(page.getByTestId(`unit-banner-${secondUnit.id}`)).toHaveCSS('background-color', 'rgb(34, 197, 94)');
  await expect(page.getByTestId(`journey-coin-face-${secondUnit.lessons[0]!.id}`)).toHaveCSS('background-color', 'rgb(34, 197, 94)');
  await expect(page.getByTestId(`unit-banner-${learningUnits.at(-1)!.id}`)).toHaveCSS('background-color', 'rgb(30, 58, 138)');
  await trophy.scrollIntoViewIfNeeded();
  await capture(page, info, 'unit-one-trophy-before-unit-two');
});
