import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { createTestDatabase, createTestUser, databaseRpc } from '../tests/helpers/database.ts';

const owner = '00000000-0000-4000-8000-000000000901';
const db = await createTestDatabase(), browser = await chromium.launch({ headless: true });
const errors = [], requests = [];
await createTestUser(db, owner, 'energia_admin'); await db.query('insert into arca_admins(user_id) values($1)', [owner]);
const now = new Date().toISOString(), expires = Math.floor(Date.now() / 1000) + 3600;
const user = { id: owner, email: 'energy-admin@example.test', aud: 'authenticated', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, created_at: now };
const session = { user, access_token: `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ sub: owner, role: 'authenticated', exp: expires })).toString('base64url')}.test-only`, refresh_token: 'test-only', token_type: 'bearer', expires_in: 3600, expires_at: expires };
const names = new Set(['arca_admin_access', 'arca_admin_overview', 'arca_admin_reports', 'arca_admin_energy', 'arca_admin_energy_update']);
await mkdir('artifacts/screenshots/energy-admin', { recursive: true });
try {
  for (const width of [320, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    await context.addInitScript(session => localStorage.setItem('arca.admin.session.v1', JSON.stringify(session)), session);
    // Every external request is intercepted; no operation reaches the real Supabase project.
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'localhost') { await route.continue(); return; }
      try {
        if (!url.hostname.endsWith('.supabase.co')) throw new Error('External request: ' + url.hostname);
        if (url.pathname === '/auth/v1/user') { await route.fulfill({ json: user }); return; }
        const name = url.pathname.split('/').at(-1);
        if (!names.has(name)) throw new Error('Unexpected RPC ' + name);
        const args = route.request().postDataJSON() ?? {}; requests.push(name);
        const data = await databaseRpc(db, owner, name, args);
        await route.fulfill({ status: 200, json: data });
      } catch (error) { errors.push(error.message); await route.abort(); }
    });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    await page.goto('http://localhost:8090');
    await page.getByRole('button', { name: 'Energia', exact: true }).click();
    const enabled = page.getByRole('checkbox', { name: 'Restringir novas lições por energia', exact: true });
    await enabled.waitFor(); assert.equal(await enabled.isChecked(), false);
    await enabled.check(); await page.getByLabel('Contas elegíveis', { exact: true }).selectOption('10');
    await page.getByRole('button', { name: 'Salvar configuração', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#energy-form [type="submit"]:not([disabled])'));
    const value = await databaseRpc(db, owner, 'arca_admin_energy'); assert.equal(value.enabled, true); assert.equal(value.rollout, 10);
    await page.getByRole('heading', { name: 'Disponibilidade', exact: true }).waitFor();
    await page.screenshot({ path: `artifacts/screenshots/energy-admin/dashboard-${width}.png`, fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await enabled.uncheck(); await page.getByRole('button', { name: 'Salvar configuração', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#energy-form [type="submit"]:not([disabled])'));
    assert.equal((await databaseRpc(db, owner, 'arca_admin_energy')).enabled, false);
    await context.close(); console.log(`PASS ${width}px: private energy panel, real SQL configuration, staged rollout, kill switch, no overflow.`);
  }
  assert.deepEqual(errors, []); assert.ok(requests.includes('arca_admin_energy_update'));
} finally { await browser.close(); await db.close(); }
