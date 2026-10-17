import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--no-proxy-server'] });
const base = process.env.ARCA_QA_URL ?? 'http://localhost:8085';
const errors = [];
await mkdir('artifacts/screenshots/unit-overview', { recursive: true });
try {
  for (const width of [320,390,430,1280]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
    await context.route('https://*.supabase.co/**', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"offline_qa"}' }));
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.getByRole('button', { name: 'Já tenho uma conta', exact: true }).click();
    await page.getByRole('button', { name: 'Continuar sem conta', exact: true }).click();
    await page.getByRole('tab', { name: 'Aprender', exact: true }).click();
    const cards = page.locator('[data-testid^="unit-card-"]');
    await cards.first().waitFor();
    assert.equal(await cards.count(),10);
    const images = new Set();
    for (const card of await cards.all()) {
      const data = await card.evaluate(async element => {
        const img = element.querySelector('img'); await img.decode();
        const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64;
        const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, 64, 64);
        const pixels = ctx.getImageData(0,0,64,64).data;
        let visible = 0; for(let i = 3; i < pixels.length; i += 4) if(pixels[i] > 128) visible++;
        const title = element.querySelector('[role="heading"]');
        const art = element.querySelector('[data-testid^="unit-art-"]');
        const t = title.getBoundingClientRect(), a = art.getBoundingClientRect(), r = element.getBoundingClientRect();
        const walker = document.createTreeWalker(title, NodeFilter.SHOW_TEXT);
        let node, splitWord = false;
        while ((node = walker.nextNode())) for(const match of node.textContent.matchAll(/\S+/g)) {
          const range = document.createRange(); range.setStart(node, match.index); range.setEnd(node, match.index + match[0].length);
          if(range.getClientRects().length > 1) splitWord = true;
        }
        return { src: img.src, visible, width: img.naturalWidth, corner: pixels[3], fits: !splitWord && t.right <= a.left + 1 && a.right <= r.right && title.scrollWidth <= title.clientWidth + 1, label: element.getAttribute('aria-label') };
      });
      assert.ok(data.visible > 300 && data.width >= 512, 'Artwork is nonblank and bundled');
      assert.equal(data.corner,0,'Cutout has real transparent background');
      assert.ok(data.fits,`Title and art fit without overlap: ${data.label} at ${width}px`);
      images.add(data.src);
    }
    assert.equal(images.size,10,'Every unit has its own illustration');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false);
    await page.screenshot({ animations:'disabled', path:`artifacts/screenshots/unit-overview/units-${width}.png` });
    const screen = page.getByTestId('continuous-scene-screen').filter({has:cards.first()});
    const scroll = screen.getByTestId('continuous-scene-scroll');
    const scene = screen.getByTestId('illustrated-background');
    await scene.locator('img').evaluate(img => img.decode());
    const top = await scene.boundingBox();
    await scroll.evaluate(element => { element.scrollTop = 700; });
    const after = await scene.boundingBox();
    assert.deepEqual(after,top,'Scenery stays behind the cards throughout scrolling');
    assert.equal(await screen.getByTestId('scrolling-illustration').count(),0);
    await page.screenshot({ animations:'disabled', path:`artifacts/screenshots/unit-overview/units-lower-${width}.png` });
    await scroll.evaluate(element => { element.scrollTop = 0; });
    await cards.first().click();
    await page.waitForURL('**/unit/conhecendo-a-biblia');
    await page.getByRole('button',{name:'Continuar lição',exact:true}).waitFor();
    await page.getByRole('button',{name:'O que é a Bíblia?, Disponível',exact:true}).waitFor();
    await page.evaluate(async () => { await Promise.all([...document.images].map(img => img.decode())); });
    await page.screenshot({ animations:'disabled', path:`artifacts/screenshots/unit-overview/journey-${width}.png` });
    const journey = page.getByTestId('continuous-scene-screen').filter({has:page.getByRole('button',{name:'O que é a Bíblia?, Disponível',exact:true})});
    const journeyScroll = journey.getByTestId('continuous-scene-scroll');
    const journeyScene = journey.getByTestId('illustrated-background');
    const before = await journeyScene.boundingBox();
    await journeyScroll.evaluate(element => { element.scrollTop = element.scrollHeight; });
    assert.ok(await journeyScroll.evaluate(element => element.scrollTop) > 500);
    assert.deepEqual(await journeyScene.boundingBox(),before,'Valley stays visible at the last lessons');
    assert.equal(await journey.getByTestId('scrolling-illustration').count(),0,'No fading layer in the coin trail');
    await page.screenshot({ animations:'disabled', path:`artifacts/screenshots/unit-overview/journey-bottom-${width}.png` });
    await page.getByRole('button',{name:'Voltar às unidades',exact:true}).click();
    await page.getByTestId('unit-card-personagens-e-historias').click();
    await page.getByText('Conclua Conhecendo a Bíblia para liberar estas lições.',{exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Continuar lição',exact:true}).count(),0);
    await page.getByRole('button',{name:'Personagens importantes, Bloqueada',exact:true}).click();
    await page.getByText('Conclua Lendo em contexto para liberar.',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Voltar às unidades',exact:true}).first().click();
    await cards.first().click();
    await page.getByRole('button',{name:'Continuar lição',exact:true}).click();
    await page.waitForURL('**/lesson/o-que-e-a-biblia');
    await context.close();
    console.log(`PASS ${width}px: ten unique transparent assets, card fit, scroll, unit route/back, locked unit and real lesson launch.`);
  }
  assert.deepEqual(errors,[]);
} finally { await browser.close(); }
