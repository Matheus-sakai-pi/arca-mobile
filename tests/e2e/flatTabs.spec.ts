import { test, expect } from './fixtures';
import { capture } from './actions';

// Estilo plano: abas com fundo branco, sem cenário, e seis abas só com ícones.
test('tabs use the flat white background and six icon tabs, including Friends and Achievements', async ({ page, context, backend }, info) => {
  await backend.completeLessons(1); await backend.install(context);
  const routes = { home: 'Início', learn: 'Aprender', ranking: 'Ranking', friends: 'Amigos', achievements: 'Conquistas', profile: 'Perfil' };
  for (const [route, name] of Object.entries(routes)) {
    await page.goto(`/${route}`);
    await expect(page.getByRole('tab', { name, selected: true })).toBeVisible();
    await expect(page.getByTestId('scrolling-illustration')).toHaveCount(0);
    await expect(page.getByTestId('continuous-scene-screen')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  for (const name of ['Início', 'Aprender', 'Ranking', 'Amigos', 'Conquistas', 'Perfil']) await expect(page.getByRole('tab', { name })).toBeVisible();
  await page.getByRole('tab', { name: 'Conquistas' }).click();
  await expect(page.getByTestId('achievement-stats')).toContainText('Lições');
  await expect(page.getByTestId('achievement-icon-first_step')).toBeVisible();
  await capture(page, info, 'achievements-tab');
  await page.getByRole('tab', { name: 'Amigos' }).click();
  await expect(page.getByRole('heading', { name: 'Amigos', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Desafios entre amigos', exact: true })).toBeVisible();
  await capture(page, info, 'friends-tab');
});
