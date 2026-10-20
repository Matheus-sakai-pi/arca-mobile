import { test, expect } from './fixtures.ts';
import { learningUnits } from '../../src/data/lessons.ts';
import { capture } from './actions.ts';

const first = learningUnits[0]!, second = learningUnits[1]!;

for (const reduceMotion of [false, true]) {
  test(`current lesson scrolling ${reduceMotion ? 'respects reduced motion' : 'moves smoothly through intermediate lessons'}`, async ({ page, context, backend }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await backend.completeLessons(7);
    await backend.install(context);
    await context.addInitScript(({ owner, reduceMotion }) => {
      localStorage.setItem(`arca.preferences.${owner}.v1`, JSON.stringify({
        soundEnabled: false, hapticsEnabled: false, reduceMotion, dailyGoal: 20,
      }));
      const samples: number[] = [];
      Object.assign(window, { trailScrollSamples: samples });
      document.addEventListener('scroll', event => {
        const target = event.target;
        if (target instanceof HTMLElement && target.dataset.testid === 'current-lesson-scroll' && target.scrollTop > 0) {
          samples.push(target.scrollTop);
        }
      }, true);
    }, { owner: backend.owner, reduceMotion });
    await page.goto('/learn');
    const current = first.lessons[7]!;
    await expect(page.getByTestId('journey-start-' + current.id)).toBeInViewport({ ratio: 1 });
    const samples = () => page.evaluate(() =>
      (window as unknown as { trailScrollSamples: number[] }).trailScrollSamples,
    );
    if (reduceMotion) {
      await expect.poll(async () => new Set(await samples()).size).toBe(1);
    } else {
      await expect.poll(async () => new Set(await samples()).size).toBeGreaterThan(3);
      const values = await samples();
      // Animada: passa por posições intermediárias antes de chegar à lição atual.
      expect(values[0]!).toBeLessThan(values.at(-1)!);
    }
  });
}

test('opening, reloading and returning to a unit shows the current lesson without trapping manual scrolling', async ({ page, context, backend }, info) => {
  await backend.completeLessons(7);
  await backend.install(context);
  const current = first.lessons[7]!;
  const currentButton = page.getByRole('button', { name: current.title + ', Atual', exact: true });
  await page.goto('/learn');
  const scroll = page.getByTestId('current-lesson-scroll');
  await expect(currentButton).toBeInViewport({ ratio: 1 });
  await expect(page.getByTestId('journey-start-' + current.id)).toBeInViewport({ ratio: 1 });
  await expect.poll(() => scroll.evaluate(el => el.scrollTop)).toBeGreaterThan(700);
  await expect(page.getByLabel('Arca', { exact: true })).toBeInViewport();
  await expect(page.getByRole('tab', { name: 'Aprender', exact: true })).toBeInViewport();
  await capture(page, info, 'current-lesson-on-open');
  await page.reload();
  await expect(currentButton).toBeInViewport({ ratio: 1 });
  await scroll.evaluate(el => { el.scrollTop = 0; });
  await expect.poll(() => scroll.evaluate(el => el.scrollTop)).toBe(0);
  const viewport = page.viewportSize()!;
  await page.setViewportSize({ width: viewport.width, height: viewport.height + 60 });
  await expect(page.getByTestId('unit-banner-' + first.id)).toBeInViewport({ ratio: 1 });
  await expect.poll(() => scroll.evaluate(el => el.scrollTop)).toBe(0);
  // Reviewing an earlier lesson must not change the current progression anchor.
  await page.getByRole('button', { name: first.lessons[0]!.title + ', Concluída', exact: true }).click();
  await expect(page).toHaveURL(new RegExp('/lesson/' + first.lessons[0]!.id));
  await page.goBack();
  await expect(currentButton).toBeInViewport({ ratio: 1 });
});

test('the selected second unit scrolls to its own current lesson, including the chest offset', async ({ page, context, backend }, info) => {
  await backend.completeLessons(16);
  await backend.install(context);
  const current = second.lessons[6]!;
  await page.goto('/learn');
  await expect(page.getByRole('button', { name: current.title + ', Atual', exact: true })).toBeInViewport({ ratio: 1 });
  await expect(page.getByTestId('journey-start-' + current.id)).toBeInViewport({ ratio: 1 });
  await expect.poll(() => page.getByTestId('current-lesson-scroll').evaluate(el => el.scrollTop)).toBeGreaterThan(700);
  // Trilha única: todas as unidades aparecem na mesma tela.
  await expect(page.locator('[data-testid^="trail-section-"]')).toHaveCount(10);
  await capture(page, info, 'second-unit-current-lesson');
});

test('a new account starts at the top of the journey, and finishing a unit moves the start to the next one', async ({ page, context, backend }) => {
  await backend.install(context);
  await page.goto('/learn');
  const scroll = page.getByTestId('current-lesson-scroll');
  await expect(page.getByRole('button', { name: first.lessons[0]!.title + ', Disponível', exact: true })).toBeInViewport({ ratio: 1 });
  await expect(page.getByTestId('unit-banner-' + first.id)).toBeInViewport({ ratio: 1 });
  await expect.poll(() => scroll.evaluate(el => el.scrollTop)).toBe(0);
  await backend.completeLessons(10);
  await page.reload();
  // A primeira lição da unidade 2 vira a atual, e a trilha abre nela.
  await expect(page.getByTestId('journey-start-' + second.lessons[0]!.id)).toBeInViewport({ ratio: 1 });
  await expect.poll(() => scroll.evaluate(el => el.scrollTop)).toBeGreaterThan(700);
  await expect(page.locator('[data-testid^="journey-start-"]')).toHaveCount(1);
});
