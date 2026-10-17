import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import { createServer } from 'node:http';
import { initialUnit, learningUnits } from '../src/data/lessons.ts';
import { createProgress } from '../src/lib/learningProgress.ts';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--no-proxy-server'] });
const base = process.env.ARCA_QA_URL ?? 'http://127.0.0.1:8084';
const errors = [];
const userId = '00000000-0000-4000-8000-000000000099';
const date = '2026-10-14T12:00:00.000Z';
const user = { id: userId, email: 'test@example.test', aud: 'authenticated', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: { display_name: 'Conta descartável' }, identities: [], created_at: date };
const token = ['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', Buffer.from(JSON.stringify({ sub: userId, email: user.email, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url'), 'fake-test-signature'].join('.');
const session = { access_token: token, refresh_token: 'fake-test-refresh', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user };
const profile = { id: userId, display_name: '@teste_privacidade', username: 'teste_privacidade', avatar_key: 'owl', avatar_url: null, xp_total: 0, current_streak: 0, longest_streak: 0, last_activity_date: null, created_at: date, updated_at: date };
const snapshot = { unitId: initialUnit.id, xp: 0, completedLessonIds: [], lastResult: null, guestImported: false, profile };
const questions = initialUnit.lessons.flatMap(lesson => lesson.questions.map((question, order_index) => {
  const { id, type, prompt, explanation, ...content } = question;
  return { id, type, prompt, explanation, content, order_index, lesson_id: lesson.id };
}));
const server = createServer(async (request, response) => {
  const name = request.url?.split('?')[0]?.slice(1) || 'index.html';
  if (!['index.html', 'excluir-conta.html', 'request.js', 'site.css', 'arca-icon.png'].includes(name)) { response.writeHead(404).end(); return; }
  const data = await readFile(new URL('../legal-site/dist/' + name, import.meta.url));
  const type = name.endsWith('.html') ? 'text/html' : name.endsWith('.css') ? 'text/css' : name.endsWith('.js') ? 'text/javascript' : 'image/png';
  response.writeHead(200, { 'Content-Type': type });
  response.end(name === 'request.js' ? data.toString().replace('window.location.href =', 'window.__preparedEmailUrl =') : data);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const externalBase = 'http://127.0.0.1:' + server.address().port;
await mkdir('artifacts/screenshots/privacy', { recursive: true });
try {
  for (const width of [320, 390, 430]) {
    const context = await browser.newContext({ viewport: { width, height: width === 320 ? 640 : 844 }, reducedMotion: 'reduce' });
    let deletionCalls = 0;
    await context.route('https://*.supabase.co/**', async route => {
      const url = new URL(route.request().url()); const path = url.pathname;
      let data;
      if (path.endsWith('/units')) data = learningUnits.map((unit, order_index) => ({ id: unit.id, title: unit.title, course_id: 'biblia-basica', order_index }));
      else if (path.endsWith('/lessons')) data = learningUnits.flatMap(unit => unit.lessons.map((lesson, order_index) => ({ ...lesson, unit_id: unit.id, order_index })));
      else if (path.endsWith('/questions')) { const offset = Number(url.searchParams.get('offset') ?? 0); const limit = Number(url.searchParams.get('limit') ?? 1000); data = questions.slice(offset, offset + limit); }
      else if (path.endsWith('/learning_snapshot')) data = snapshot;
      else if (path.endsWith('/user')) data = user;
      else if (path.endsWith('/logout')) { await route.fulfill({ status: 204 }); return; }
      else if (path.endsWith('/delete-account')) {
        deletionCalls++; const body = route.request().postDataJSON();
        assert.deepEqual(Object.keys(body), ['password']);
        assert.equal(route.request().headers().authorization, 'Bearer ' + token);
        if (body.password === 'wrong-password') { await route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: 'invalid_credentials' }) }); return; }
        assert.equal(body.password, 'test-password'); data = { deleted: true, userId };
      } else { await route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"test_unexpected_endpoint"}' }); return; }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
    });
    await context.addInitScript(({ session, guest }) => {
      if (localStorage.getItem('qa-seeded')) return;
      localStorage.setItem('qa-seeded', '1');
      localStorage.setItem('sb-kuawynauynlyieocaahr-auth-token', JSON.stringify(session));
      localStorage.setItem('arca.learning.v1', JSON.stringify(guest));
      localStorage.setItem('arca.account.other.v1', 'other-account');
      localStorage.setItem(`arca.study.${session.user.id}.v1`, JSON.stringify({version:1,scope:session.user.id,drafts:{},history:[]}));
      localStorage.setItem(`arca.preferences.${session.user.id}.v1`, JSON.stringify({soundEnabled:true,hapticsEnabled:true,reduceMotion:false,dailyGoal:20}));
    }, { session, guest: createProgress() });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/profile', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.getByRole('button', { name: 'Excluir conta', exact: true }).waitFor({ timeout: 120000 });
    await page.getByRole('button', { name: 'Política de Privacidade', exact: true }).click();
    await page.getByRole('heading', { name: 'Política de Privacidade', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `artifacts/screenshots/privacy/policy-${width}.png` });
    await page.getByRole('button', { name: 'Voltar', exact: true }).click();
    await page.getByRole('button', { name: 'Excluir conta', exact: true }).click();
    const remove = page.getByRole('button', { name: 'Excluir minha conta', exact: true });
    await remove.waitFor(); assert.equal(await remove.isDisabled(), true);
    await page.getByRole('checkbox', { name: 'Entendo que a exclusão é permanente' }).click();
    assert.equal(await remove.isDisabled(), true);
    await page.getByLabel('Senha atual', { exact: true }).fill('wrong-password');
    await remove.click(); await page.getByText('Senha incorreta. Sua conta não foi excluída.', { exact: true }).waitFor();
    assert.equal(await page.evaluate(id => localStorage.getItem(`arca.account.${id}.v1`) !== null, userId), true);
    await page.getByLabel('Senha atual', { exact: true }).fill('test-password');
    await page.screenshot({ path: `artifacts/screenshots/privacy/delete-${width}.png` });
    await remove.click(); await page.getByRole('heading', { name: 'Conta excluída', exact: true }).waitFor();
    await page.screenshot({ path: `artifacts/screenshots/privacy/deleted-${width}.png` });
    const storage = await page.evaluate(id => ({ cache: localStorage.getItem(`arca.account.${id}.v1`), achievements: localStorage.getItem(`arca.achievements.${id}.v1`), auth: localStorage.getItem('sb-kuawynauynlyieocaahr-auth-token'), guest: localStorage.getItem('arca.learning.v1'), other: localStorage.getItem('arca.account.other.v1') }), userId);
    assert.equal(storage.cache, null); assert.equal(storage.achievements, null); assert.equal(storage.auth, null); assert.ok(storage.guest); assert.equal(storage.other, 'other-account');
    assert.deepEqual(await page.evaluate(id=>[localStorage.getItem(`arca.study.${id}.v1`),localStorage.getItem(`arca.preferences.${id}.v1`)],userId),[null,null]);
    assert.equal(deletionCalls, 2);
    await page.reload(); await page.getByRole('heading', { name: 'Nenhuma exclusão confirmada', exact: true }).waitFor();
    await page.goto(base + '/privacy'); await page.getByRole('heading', { name: 'Política de Privacidade', exact: true }).waitFor();
    await page.goto(externalBase + '/excluir-conta.html');
    await page.getByRole('heading', { name: 'Excluir sua conta do Arca', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.getByRole('textbox', { name: 'E-mail usado no cadastro' }).fill('test@example.test');
    await page.getByRole('checkbox').check();
    // Verify preparation without launching a real email client or sending a message.
    await page.getByRole('button', { name: 'Preparar pedido por e-mail' }).click();
    await page.getByRole('status').getByText(/Nada foi enviado automaticamente/).waitFor();
    assert.ok((await page.evaluate(() => window.__preparedEmailUrl)).startsWith('mailto:matheussakai23032001@gmail.com?'));
    await page.screenshot({ path: `artifacts/screenshots/privacy/external-${width}.png` });
    console.log(`PASS ${width}px: privacy, wrong password, mocked deletion, scoped cleanup, guest preserved, external request.`);
    await context.close();
  }
  assert.deepEqual(errors, []);
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
