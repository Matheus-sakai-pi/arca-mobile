import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile, copyFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { extname, resolve, sep } from 'node:path';
import { initialUnit, learningUnits } from '../src/data/lessons.ts';
import { completeLesson, createProgress } from '../src/lib/learningProgress.ts';
import { eligibleAchievements } from '../src/lib/achievements.ts';
import { localDay } from '../src/lib/studyStore.ts';
import { destination, listing } from './prepare-store-listing.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const sharp = require('sharp');
const webRoot = resolve('.cache/play-store-web');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.wav': 'audio/wav', '.ico': 'image/x-icon' };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const gallery = pathname.startsWith('/store/');
    const root = gallery ? destination : webRoot;
    let file = resolve(root, '.' + (gallery ? pathname.slice(6) : pathname));
    if (file !== root && !file.startsWith(root + sep)) { response.writeHead(403).end(); return; }
    if (file === root || !(await stat(file).catch(() => null))?.isFile()) file = resolve(root, gallery ? 'previa.html' : 'index.html');
    response.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream' });
    response.end(await readFile(file));
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--no-proxy-server'] });
const owner = '00000000-0000-4000-8000-000000000080';
const now = new Date();
const results = [];
let progress = createProgress();
for (const [index, lesson] of initialUnit.lessons.slice(0, 5).entries()) {
  const completed = new Date(now); completed.setDate(completed.getDate() - 4 + index);
  progress = completeLesson(progress, lesson, Object.fromEntries(lesson.questions.map(question => [question.id, question.correctAnswer])), `store-demo-${index}`, completed.toISOString());
  results.push(progress.lastResult);
}
const profile = { id: owner, display_name: '@noe_arca', username: 'noe_arca', avatar_key: 'dove', avatar_url: null, xp_total: progress.xp, current_streak: 5, longest_streak: 5, last_activity_date: localDay(now), created_at: now.toISOString(), updated_at: now.toISOString() };
const user = { id: owner, email: 'demonstracao@example.test', aud: 'authenticated', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: { display_name: profile.display_name }, identities: [], created_at: now.toISOString() };
const access = ['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', Buffer.from(JSON.stringify({ sub: owner, email: user.email, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url'), 'isolated-store-demo-signature'].join('.');
const session = { access_token: access, refresh_token: 'isolated-store-demo-refresh', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user };
const people = [
  { id: '00000000-0000-4000-8000-000000000081', username: 'ana_luz', display_name: '@ana_luz', avatar_key: 'avatar-03', relationship: 'friend' },
  { id: '00000000-0000-4000-8000-000000000082', username: 'leo_fe', display_name: '@leo_fe', avatar_key: 'avatar-04', relationship: 'friend' },
  { id: '00000000-0000-4000-8000-000000000083', username: 'bia_paz', display_name: '@bia_paz', avatar_key: 'avatar-05', relationship: 'incoming' },
];
const leaderboard = [profile, ...people].map((person, index) => ({ id: person.id, display_name: person.display_name, avatar_key: person.avatar_key, xp_total: progress.xp - index * 35, position: index + 1 }));
const questions = initialUnit.lessons.flatMap(lesson => lesson.questions.map(({ id, type, prompt, explanation, ...content }, order_index) => ({ id, type, prompt, explanation, content, order_index, lesson_id: lesson.id })));
const failures = [];
const context = await browser.newContext({ viewport: { width: 432, height: 768 }, deviceScaleFactor: 2.5, reducedMotion: 'reduce', locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
await context.route('https://*.supabase.co/**', async route => {
  const url = new URL(route.request().url()), path = url.pathname;
  const body = route.request().postDataJSON();
  let payload;
  if (path.endsWith('/learning_leaderboard')) payload = { top: leaderboard, current: leaderboard[0] };
  else if (path.endsWith('/learning_leaderboard_scope') && body.p_scope === 'friends') payload = { top: leaderboard.slice(0, 3), current: leaderboard[0] };
  else if (path.endsWith('/learning_friends')) payload = { friends: people.filter(person => person.relationship === 'friend'), incoming: people.filter(person => person.relationship === 'incoming'), outgoing: [] };
  else if (path.endsWith('/units')) payload = learningUnits.map((unit, order_index) => ({ id: unit.id, title: unit.title, course_id: 'biblia-basica', order_index }));
  else if (path.endsWith('/lessons')) payload = learningUnits.flatMap(unit => unit.lessons.map((lesson, order_index) => ({ ...lesson, unit_id: unit.id, order_index })));
  else if (path.endsWith('/questions')) payload = questions.slice(Number(url.searchParams.get('offset') ?? 0), Number(url.searchParams.get('offset') ?? 0) + Number(url.searchParams.get('limit') ?? 1000));
  else if (path.endsWith('/learning_snapshot')) payload = { unitId: initialUnit.id, xp: progress.xp, completedLessonIds: progress.completedLessonIds, lastResult: progress.lastResult, guestImported: false, profile };
  else if (path.endsWith('/lesson_attempts')) payload = results.map(result => ({ result }));
  else if (path.endsWith('/start_learning_lesson')) payload = null;
  else if (path.endsWith('/user')) payload = user;
  else { failures.push(`Unexpected endpoint: ${path}`); await route.abort(); return; }
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
});
await context.route('**/*', async route => {
  if (new URL(route.request().url()).origin === base || /\.supabase\.co$/.test(new URL(route.request().url()).hostname)) await route.fallback();
  else { failures.push('Unexpected external request'); await route.abort(); }
});
const unlocked = eligibleAchievements({ progress, units: learningUnits, longestStreak: 5 });
await context.addInitScript(({ session, owner, unlocked, results }) => {
  if (localStorage.getItem('store-demo-seeded')) return;
  localStorage.setItem('store-demo-seeded', '1');
  localStorage.setItem('sb-kuawynauynlyieocaahr-auth-token', JSON.stringify(session));
  localStorage.setItem('arca.onboarding.v1', 'done');
  localStorage.setItem(`arca.preferences.${owner}.v1`, JSON.stringify({ soundEnabled: false, hapticsEnabled: false, reduceMotion: true, dailyGoal: 20 }));
  localStorage.setItem(`arca.achievements.${owner}.v1`, JSON.stringify({ version: 1, unlocked, pending: [] }));
  localStorage.setItem(`arca.study.${owner}.v1`, JSON.stringify({ version: 1, scope: owner, history: results.map(result => ({ day: result.completedAt.slice(0, 10), mistakes: [], result })), drafts: {} }));
}, { session, owner, unlocked, results });
const page = await context.newPage(); page.setDefaultTimeout(45000);
page.on('pageerror', error => failures.push(error.message));
async function go(path) { await page.goto(base + path, { waitUntil: 'networkidle' }); }
async function shot(file) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map(image => image.decode()));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.doesNotMatch(await page.locator('body').innerText(), /Não foi possível|Erro inesperado/);
  const buffer = await page.screenshot({ animations: 'disabled' });
  const image = sharp(buffer).removeAlpha().toColourspace('srgb');
  const metadata = await image.metadata();
  assert.equal(metadata.width, 1080); assert.equal(metadata.height, 1920);
  assert.ok((await image.stats()).channels.some(channel => channel.stdev > 20), 'Screenshot is nonblank');
  await image.png().toFile(resolve(destination, 'capturas', file));
  console.log('Captured ' + file);
}
try {
  await go('/learn'); await page.getByTestId('unit-card-conhecendo-a-biblia').waitFor();
  assert.equal(await page.locator('[data-testid^="unit-card-"]').count(), 10);
  await shot('01-aprender.png');
  await page.getByTestId('unit-card-conhecendo-a-biblia').click();
  await page.getByRole('button', { name: 'Continuar lição', exact: true }).waitFor();
  const currentCoin = page.getByRole('button', { name: 'Histórias, poemas e cartas, Atual', exact: true });
  await currentCoin.waitFor();
  await currentCoin.evaluate(element => {
    const scroll = element.closest('[data-testid="continuous-scene-scroll"]');
    scroll.scrollTop += element.getBoundingClientRect().top - scroll.getBoundingClientRect().top - 400;
  });
  await shot('02-trilha.png');
  await page.getByRole('button', { name: 'Continuar lição', exact: true }).click();
  await page.getByRole('radio', { name: 'Salmos', exact: true }).click();
  await shot('03-exercicio.png');
  await go('/lesson/result'); await page.getByRole('heading', { name: 'Lição concluída!', exact: true }).waitFor();
  await shot('04-resultado.png');
  await go('/home'); await page.getByTestId('home-brand-logo').waitFor();
  await shot('05-inicio.png');
  await go('/ranking'); await page.getByTestId('leaderboard-podium').waitFor();
  await shot('06-ranking.png');
  await page.getByRole('tab', { name: 'AMIGOS', exact: true }).click();
  await page.getByRole('button', { name: 'Gerenciar amigos', exact: true }).click();
  await page.getByText('Meus amigos · 2', { exact: true }).waitFor();
  await shot('07-amigos.png');
  await go('/profile'); await page.getByTestId('achievements-section').waitFor();
  await page.getByTestId('achievements-section').evaluate(element => {
    const scroll = element.closest('[data-testid="illustrated-scroll"]');
    scroll.scrollTop += element.getBoundingClientRect().top - scroll.getBoundingClientRect().top - 24;
  });
  await shot('08-conquistas.png');
  assert.deepEqual(failures, []);
  await copyFile('store/pt-BR/README.md', resolve(destination, 'LEIA-ME.md'));
  const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
  const gallery = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Arca | Materiais da Play Store</title><style>*{box-sizing:border-box}body{margin:0;background:#f1f5fc;color:#171734;font-family:Segoe UI,Arial,sans-serif}main{max-width:1320px;margin:auto;padding:40px 24px}h1{font-size:32px;margin:0 0 10px}p{line-height:1.6}header{margin-bottom:32px}.feature{width:100%;max-width:1024px;display:block}.identity{display:flex;gap:24px;align-items:center;margin:24px 0}.icon{width:88px;height:88px}a{color:#004cde}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:28px 20px}figure{margin:0}figure img{width:100%;display:block;border:1px solid #d7e1f1}figcaption{font-size:16px;font-weight:600;min-height:54px;margin-top:12px}small{font-weight:400;color:#54556a;display:block;margin-top:6px}@media(max-width:760px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}main{padding:24px 16px}}</style><main><header><h1>Arca: Aprenda a Bíblia</h1><p>Materiais da Play Store · Português do Brasil · 15/10/2026<br>Capturas da prévia web de produção, com contas de demonstração. Conferir com o Android instalado antes de publicar.</p><img class="feature" src="destaque-1024x500.png" alt="${escape(listing.featureGraphicAlt)}"><div class="identity"><img class="icon" src="icone-512.png" alt="Ícone do Arca"><div><strong>${escape(listing.shortDescription)}</strong><p><a href="textos/descricao-completa.txt">Descrição completa</a> · <a href="textos/novidades.txt">Novidades</a> · <a href="textos/textos-alternativos.txt">Textos alternativos</a></p></div></div></header><section class="grid">${listing.screenshots.map((item, index) => `<figure><a href="capturas/${item.file}"><img src="capturas/${item.file}" alt="${escape(item.alt)}"></a><figcaption>${String(index + 1).padStart(2, '0')} · ${escape(item.title)}<small>1080 × 1920</small></figcaption></figure>`).join('')}</section></main></html>`;
  await writeFile(resolve(destination, 'previa.html'), gallery, 'utf8');
  const overview = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  await overview.goto(base + '/store/previa.html', { waitUntil: 'networkidle' });
  await overview.evaluate(async () => Promise.all([...document.images].map(image => image.decode())));
  await overview.screenshot({ path: resolve(destination, 'visao-geral.jpg'), fullPage: true, type: 'jpeg', quality: 88 });
  const files = ['icone-512.png', 'destaque-1024x500.png', ...listing.screenshots.map(item => 'capturas/' + item.file)];
  const checks = [];
  for (const file of files) {
    const buffer = await readFile(resolve(destination, file));
    const metadata = await sharp(buffer).metadata();
    assert.equal(metadata.channels, file.startsWith('icone') ? 4 : 3);
    assert.ok(buffer.length < (file.startsWith('icone') ? 1024 * 1024 : 8 * 1024 * 1024));
    checks.push({ file, width: metadata.width, height: metadata.height, channels: metadata.channels, bytes: buffer.length, sha256: createHash('sha256').update(buffer).digest('hex') });
  }
  await writeFile(resolve(destination, 'verificacao.json'), JSON.stringify({ date: now.toISOString(), source: 'Production web export; isolated fictional accounts; not an Android installation', errors: failures, files: checks }, null, 2) + '\n');
  console.log('PASS: eight RGB screenshots, dimensions, text limits, image sizes and private demo network checked. No remote writes.');
} finally { await context.close(); await browser.close(); await new Promise(resolve => server.close(resolve)); }
