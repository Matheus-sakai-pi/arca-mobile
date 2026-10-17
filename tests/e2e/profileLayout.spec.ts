import { test, expect } from './fixtures';
import { capture } from './actions';

test('profile shows real streak and XP, keeps avatar buttons compact, and opens the picker with either motion preference', async ({ page, context, backend }, info) => {
  await backend.completeLessons(2); await backend.install(context);
  for (const reduced of [true, false]) {
    await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
    await page.goto('/profile');
    await page.evaluate(({ owner, reduced }) => {
      const key = `arca.preferences.${owner}.v1`;
      localStorage.setItem(key, JSON.stringify({ ...JSON.parse(localStorage.getItem(key)!), reduceMotion: reduced }));
    }, { owner: backend.owner, reduced });
    await page.reload();
    const stats = page.getByTestId('learning-stats');
    const values = stats.getByTestId('animated-number-value');
    await expect(values.nth(0)).toHaveText('1');
    await expect(values.nth(1)).toHaveText('70 XP');
    for (const value of await values.all()) {
      const box = (await value.boundingBox())!;
      expect(box.width).toBeGreaterThan(5); expect(box.height).toBeGreaterThan(10);
      await expect(value).toHaveCSS('opacity', '1');
    }
    const button = page.getByRole('button', { name: 'Escolher avatar', exact: true });
    await button.scrollIntoViewIfNeeded();
    const box = (await button.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(48);
    expect(box.height).toBeLessThan(80);
    const label = (await button.getByText('Escolher avatar', { exact: true }).boundingBox())!;
    expect(label.y).toBeGreaterThanOrEqual(box.y);
    expect(label.y + label.height).toBeLessThanOrEqual(box.y + box.height);
    await capture(page, info, `profile-compact-${reduced ? 'reduced' : 'animated'}`);
    await button.click();
    await expect(page.getByRole('button', { name: 'Fechar seleção de avatar', exact: true })).toBeVisible();
    const save = page.getByRole('button', { name: 'Salvar', exact: true });
    expect((await save.boundingBox())!.height).toBeLessThan(80);
    await page.getByRole('button', { name: 'Fechar seleção de avatar', exact: true }).click();
  }
});
