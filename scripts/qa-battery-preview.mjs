import { chromium, expect as baseExpect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

// Exercise the actual loopback SQL API, with no request interception or fixtures.
const browser = await chromium.launch({ headless: true });
const expect = baseExpect.configure({ timeout: 15000 });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  page.setDefaultNavigationTimeout(90000);
  page.on('console', message => { if (message.type() === 'error') console.log('Browser error:', message.text()); });
  page.on('requestfailed', request => console.log('Preview request failed:', new URL(request.url()).origin, new URL(request.url()).pathname, request.failure()?.errorText));
  page.on('response', async response => {
    if (response.url().startsWith('http://127.0.0.1:8092/') && !response.ok()) console.log('Local API error:', response.status(), await response.text());
  });
  await expect.poll(async () => {
    try { return (await page.request.get('http://localhost:8089/onboarding', { timeout: 5000 })).status(); }
    catch { return 0; }
  }, { timeout: 90000, intervals: [1000, 2000, 5000] }).toBe(200);
  await page.goto('http://localhost:8089/onboarding');
  await page.getByRole('button', { name: 'Pular apresentação', exact: true }).click();
  await page.getByRole('button', { name: 'Continuar sem conta', exact: true }).click();
  await page.getByTestId('unit-card-conhecendo-a-biblia').click();
  await page.getByRole('button', { name: 'Continuar lição', exact: true }).click();
  const battery = page.getByTestId('lesson-energy-meter');
  await expect(battery).toHaveAccessibleName('25 de 25 energias');
  await page.getByRole('radio', { name: 'Uma coleção de livros', exact: true }).click();
  await page.getByRole('button', { name: 'Verificar', exact: true }).click();
  await expect(battery).toHaveAccessibleName('24 de 25 energias');
  await page.reload();
  await expect(battery).toHaveAccessibleName('24 de 25 energias');
  await expect(page.getByRole('button', { name: 'Continuar', exact: true })).toBeVisible();
  await mkdir('artifacts/screenshots/battery', { recursive: true });
  await page.screenshot({ path: 'artifacts/screenshots/battery/real-local-preview-390.png', fullPage: true });
  console.log('Local guest preview: onboarding, server charge and reload passed. No production data used.');
} finally { await browser.close(); }
