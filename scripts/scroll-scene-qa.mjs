import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.env.ARCA_QA_URL ?? 'http://localhost:8085';
const browser = await chromium.launch({headless:true,channel:'chrome',args:['--no-proxy-server']});
const errors = [];
await mkdir('artifacts/screenshots/scroll-scene',{recursive:true});
try {
  for (const width of JSON.parse(process.env.ARCA_QA_WIDTHS ?? '[320,390,430,1280]')) {
    const context=await browser.newContext({viewport:{width,height:width === 320 ? 640 : 844},reducedMotion:'reduce'});
    await context.route('https://*.supabase.co/**',route=>route.fulfill({status:503,contentType:'application/json',body:'{"error":"offline_qa"}'}));
    const page=await context.newPage();page.setDefaultTimeout(60000);page.setDefaultNavigationTimeout(120000);
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base,{waitUntil:'domcontentloaded'});
    await page.getByRole('button',{name:'Já tenho uma conta',exact:true}).click();
    await page.getByRole('button',{name:'Continuar sem conta',exact:true}).click();
    await page.getByTestId('home-brand-logo').waitFor();
    for (const route of ['home','profile']) {
      await page.goto(base+'/'+route,{waitUntil:'domcontentloaded'});
      const scroll=page.getByTestId('illustrated-scroll').filter({visible:true});
      const scene=scroll.getByTestId('scrolling-illustration');
      await scene.waitFor();
      const asset=await scene.evaluate(async element=>{
        const img=element.querySelector('img');if(!img)throw new Error('Scenery image missing');
        await img.decode();return {width:img.naturalWidth,height:img.naturalHeight};
      });
      assert.deepEqual(asset,{width:1024,height:1536});
      const top=await scene.boundingBox();
      assert.ok(Math.abs(top.height/top.width-1.5)<0.01);
      assert.ok(top.width<=480 && top.width<=width,'Scenery remains app-width');
      const nav=await page.getByRole('tab',{name:'Início',exact:true}).boundingBox();
      await page.screenshot({animations:'disabled',path:`artifacts/screenshots/scroll-scene/${route}-${width}-top.png`});
      await scroll.evaluate(element=>{element.scrollTop=220;});
      await page.waitForFunction(element=>element.scrollTop>=219,await scroll.elementHandle());
      const position=await scroll.evaluate(element=>element.scrollTop);
      const middle=await scene.boundingBox();
      assert.ok(Math.abs(top.y-middle.y-position)<2,'Scenery scrolls 1:1 with content');
      await page.screenshot({animations:'disabled',path:`artifacts/screenshots/scroll-scene/${route}-${width}-middle.png`});
      await scroll.evaluate(element=>{element.scrollTop=1000;});
      await page.waitForFunction(element=>element.scrollTop>=900,await scroll.elementHandle());
      const lower=await scene.boundingBox();
      assert.ok(lower.y+lower.height<=0,'Scenery leaves the viewport below the opening');
      assert.equal(await scroll.evaluate(element=>getComputedStyle(element).backgroundImage),'none');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      const afterNav=await page.getByRole('tab',{name:'Início',exact:true}).boundingBox();
      assert.equal(afterNav.y,nav.y,'Bottom navigation remains fixed');
      await page.screenshot({animations:'disabled',path:`artifacts/screenshots/scroll-scene/${route}-${width}-lower.png`});
      await scroll.evaluate(element=>{element.scrollTop=0;});
      await page.waitForFunction(element=>element.scrollTop===0,await scroll.elementHandle());
      assert.ok(Math.abs((await scene.boundingBox()).y-top.y)<2);
      await page.getByRole('button',{name:'Configurações',exact:true}).click();
      await page.getByRole('button',{name:'Fechar configurações',exact:true}).click();
      console.log(`PASS ${route} ${width}px: bitmap loaded, scroll delta exact, scene exits viewport, no overflow, navigation and controls intact.`);
    }
    await context.close();
  }
  assert.deepEqual(errors,[]);
} finally {await browser.close();}
