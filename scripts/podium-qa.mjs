import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
// Requires a temporary src/app/qa-podium.tsx re-export of tests/ui/RankingPreview.
// Remove that route after visual QA; it must never ship in the Android bundle.
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--no-proxy-server'] });
const errors = [];
try {
  await mkdir('artifacts/screenshots/podium-fix', { recursive: true });
  for (const width of [320, 390, 430]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    console.log('Checking podium viewport', width);
    await page.goto('http://127.0.0.1:8084', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.getByRole('button', { name: 'Já tenho uma conta', exact: true }).click({ timeout: 60000 });
    await page.getByRole('button', { name: 'Continuar sem conta', exact: true }).click();
    await page.getByRole('button', { name: 'Abrir meu perfil' }).waitFor();
    await page.goto('http://127.0.0.1:8084/qa-podium');
    for (const [position, title] of [[1, 'Eu em primeiro'], [2, 'Eu em segundo'], [3, 'Eu em terceiro']]) {
      await page.getByRole('button', { name: title, exact: true }).click();
      await page.waitForTimeout(600);
      const podium = page.getByTestId('leaderboard-podium');
      await podium.scrollIntoViewIfNeeded();
      const blocks = [];
      for (const rank of [1, 2, 3]) {
        const pedestal = await page.getByTestId(`podium-pedestal-${rank}`).boundingBox();
        const avatar = await page.getByTestId(`podium-avatar-${rank}`).boundingBox();
        const art = await page.getByTestId(`podium-art-${rank}`).boundingBox();
        const identity = await page.getByTestId(`podium-identity-${rank}`).boundingBox();
        assert.ok(pedestal && avatar && art && identity);
        assert.ok(avatar.y + avatar.height <= pedestal.y + 1, 'Avatar must sit just above its pedestal');
        assert.ok(pedestal.y - avatar.y - avatar.height <= 8, 'Avatar must stay connected to its pedestal');
        assert.ok(identity.y + identity.height <= pedestal.y + pedestal.height, 'Names, XP and own-user labels must fit inside the pedestal');
        assert.ok(Math.abs(art.width - pedestal.width) < 1 && Math.abs(art.height - pedestal.height) < 1, 'Artwork must fill the unpadded pedestal bounds');
        assert.ok(avatar.x >= 0 && avatar.x + avatar.width <= width, 'Avatar must not be clipped on small screens');
        blocks.push(pedestal);
      }
      const bases = blocks.map(block => block.y + block.height);
      assert.ok(Math.max(...bases) - Math.min(...bases) < 1, 'All podium bases must align');
      assert.ok(blocks[0].y < blocks[1].y && blocks[1].y < blocks[2].y, 'Gold must be highest, then silver, then bronze');
      await podium.screenshot({ path: `artifacts/screenshots/podium-fix/podium-${width}-own-${position}.png` });
    }
    for (const [count, title] of [[1, 'Um participante'], [2, 'Dois participantes'], [3, 'Dez participantes']]) {
      await page.getByRole('button', { name: title, exact: true }).click();
      assert.equal(await page.locator('[data-testid^="podium-pedestal-"]').count(), count);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    }
    await context.close();
  }
  assert.deepEqual(errors, []);
  console.log('Podium geometry passed at 320, 390 and 430px, all three own-user positions, long names and one/two/three participants.');
} finally { await browser.close(); }
