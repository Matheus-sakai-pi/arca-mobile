import { test, expect } from './fixtures';
import { capture } from './actions';

test('home and profile scenery reaches both viewport edges and still scrolls into the solid background', async ({ page, context, backend }, info) => {
  await backend.install(context);
  for (const route of ['home', 'profile']) {
    await page.goto(`/${route}`);
    const scroll = page.getByTestId('illustrated-scroll');
    const scene = page.getByTestId('scrolling-illustration');
    await expect(scene).toBeVisible();
    const image = scene.locator('img');
    await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    const viewport = (await scroll.boundingBox())!;
    const initial = (await scene.boundingBox())!;
    expect(Math.abs(initial.x - viewport.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(initial.x + initial.width - viewport.x - viewport.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(initial.height - initial.width * 1.5)).toBeLessThanOrEqual(1);
    await capture(page, info, `${route}-scenery-full-width`);
    await scroll.evaluate(element => { element.scrollTop = 160; });
    await expect.poll(async () => (await scene.boundingBox())!.y).toBeLessThan(initial.y - 100);
    const moved = (await scene.boundingBox())!;
    expect(moved.x).toBe(initial.x);
    expect(moved.width).toBe(initial.width);
    await capture(page, info, `${route}-scenery-scrolled`);
  }
});
