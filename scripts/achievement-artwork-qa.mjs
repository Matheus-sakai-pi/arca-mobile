import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { achievementDefinitions } from '../src/lib/achievements.ts';
const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--no-proxy-server'] });
const base = process.env.ARCA_QA_URL ?? 'http://localhost:8085';
const errors = [];
await mkdir('artifacts/screenshots/achievement-artwork', { recursive: true });
try {
  for (const width of JSON.parse(process.env.ARCA_QA_WIDTHS ?? '[320,390,430,1280]')) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
    await context.route('https://*.supabase.co/**', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"offline_qa"}' }));
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.getByRole('button', { name: 'Já tenho uma conta', exact: true }).click();
    await page.getByRole('button', { name: 'Continuar sem conta', exact: true }).click();
    await page.getByRole('tab', { name: 'Perfil', exact: true }).click();
    const section = page.getByTestId('achievements-section');
    await section.waitFor();
    const progressBefore = await page.evaluate(() => localStorage.getItem('arca.learning.v1'));
    const sources = new Map();
    for (const item of achievementDefinitions) {
      const row = section.getByTestId(`achievement-${item.id}`);
      const icon = row.getByTestId(`achievement-icon-${item.id}`);
      const data = await icon.evaluate(async element => {
        const img = element.querySelector('img'); await img.decode();
        const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64;
        const ctx = canvas.getContext('2d'); ctx.drawImage(img,0,0,64,64);
        const pixels = ctx.getImageData(0,0,64,64).data;
        let visible = 0; for(let i=3;i<pixels.length;i+=4) if(pixels[i]>128) visible++;
        return { src: img.src, width: img.naturalWidth, visible, corner: pixels[3], opacity: getComputedStyle(element).opacity };
      });
      assert.ok(data.width >= 512 && data.visible > 250,`Nonblank artwork: ${item.id}`);
      assert.equal(data.corner,0,'Transparent corners');
      assert.equal(data.opacity,'0.55','Locked art is subdued, not replaced by a generic icon');
      assert.match(await row.getAttribute('aria-label'),/bloqueada/);
      sources.set(item.id,data.src);
      const bounds = await icon.boundingBox(), text = await row.getByText(item.title,{exact:true}).boundingBox();
      assert.ok(bounds.x + bounds.width <= text.x,'Icon never overlaps achievement text');
    }
    assert.equal(new Set(sources.values()).size,achievementDefinitions.length);
    await section.getByTestId('achievement-first_step').scrollIntoViewIfNeeded();
    await page.screenshot({animations:'disabled',path:`artifacts/screenshots/achievement-artwork/locked-${width}.png`});
    await section.getByTestId('achievement-xp_1000').scrollIntoViewIfNeeded();
    await page.screenshot({animations:'disabled',path:`artifacts/screenshots/achievement-artwork/locked-bottom-${width}.png`});
    // Seed only the isolated QA browser's award state to inspect every celebration.
    const ids = achievementDefinitions.map(item => item.id);
    await page.evaluate(ids => localStorage.setItem('arca.achievements.guest.v1',JSON.stringify({version:1,unlocked:ids,pending:ids})),ids);
    await page.reload();
    for (const item of achievementDefinitions) {
      const modal = page.getByTestId('achievement-celebration');
      await modal.getByText(item.title,{exact:true}).waitFor();
      const art = modal.getByTestId(`achievement-icon-${item.id}`);
      const src = await art.locator('img').evaluate(async img => { await img.decode(); return img.src; });
      assert.equal(src,sources.get(item.id),'Celebration uses the exact profile artwork');
      assert.equal(await art.evaluate(element=>getComputedStyle(element).opacity),'1');
      if(item.id === 'first_step' || item.id === 'xp_1000') await page.screenshot({animations:'disabled',path:`artifacts/screenshots/achievement-artwork/modal-${item.id}-${width}.png`});
      await modal.getByRole('button',{name:'Continuar',exact:true}).click();
    }
    await page.getByTestId('achievement-celebration').waitFor({state:'hidden'});
    assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('arca.achievements.guest.v1')).pending),[]);
    assert.equal(await page.evaluate(()=>localStorage.getItem('arca.learning.v1')),progressBefore,'Art and dismissals never modify XP or learning progress');
    for(const item of achievementDefinitions) {
      const row=section.getByTestId(`achievement-${item.id}`);
      assert.match(await row.getAttribute('aria-label'),/desbloqueada/);
      assert.equal(await row.getByTestId(`achievement-icon-${item.id}`).evaluate(element=>getComputedStyle(element).opacity),'1');
    }
    await section.getByTestId('achievement-first_step').scrollIntoViewIfNeeded();
    await page.screenshot({animations:'disabled',path:`artifacts/screenshots/achievement-artwork/unlocked-${width}.png`});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    console.log(`PASS ${width}px: nine distinct transparent icons, locked/unlocked states, every celebration, dismissal persistence, unchanged XP and no overlap.`);
    await context.close();
  }
  assert.deepEqual(errors,[]);
} finally { await browser.close(); }
