import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.env.ARCA_QA_URL ?? 'http://localhost:8085';
const browser = await chromium.launch({headless:true,channel:'chrome',args:['--no-proxy-server']});
const errors = [];
await mkdir('artifacts/screenshots/home-logo',{recursive:true});
try {
  for (const width of [320,390,430,1280]) {
    const context = await browser.newContext({viewport:{width,height:width === 320 ? 640 : 844},reducedMotion:'reduce'});
    await context.route('https://*.supabase.co/**',route=>route.fulfill({status:503,contentType:'application/json',body:'{"error":"offline_qa"}'}));
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base,{waitUntil:'domcontentloaded',timeout:120000});
    await page.getByRole('button',{name:'Já tenho uma conta',exact:true}).click();
    await page.getByRole('button',{name:'Continuar sem conta',exact:true}).click();
    const logo = page.getByTestId('home-brand-logo');
    await logo.waitFor();
    const loaded = await logo.evaluate(async element=>{
      const img=element instanceof HTMLImageElement ? element : element.querySelector('img');
      if(!img) throw new Error('Logo image element missing');
      await img.decode();
      const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
      const context=canvas.getContext('2d');context.drawImage(img,0,0);
      const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;
      let visible=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>128)visible++;
      return {width:img.naturalWidth,height:img.naturalHeight,visible,cornerAlpha:pixels[3]};
    });
    assert.equal(loaded.width,2167);assert.equal(loaded.height,726);
    assert.equal(loaded.cornerAlpha,0);assert.ok(loaded.visible>100000);
    const bounds=await logo.boundingBox();
    const profile=await page.getByRole('button',{name:'Abrir meu perfil',exact:true}).boundingBox();
    assert.ok(bounds.x+bounds.width <= profile.x,'Logo must not overlap profile');
    assert.ok(Math.abs(bounds.y+bounds.height/2-profile.y-profile.height/2)<2,'Header controls stay aligned');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.waitForFunction(()=>[...document.images].every(img=>img.complete));
    await page.screenshot({animations:'disabled',path:`artifacts/screenshots/home-logo/home-${width}.png`});
    await page.getByRole('button',{name:'Configurações',exact:true}).click();
    await page.getByRole('button',{name:'Fechar configurações',exact:true}).click();
    await page.getByRole('button',{name:'Abrir meu perfil',exact:true}).click();
    await page.getByRole('heading',{name:'Perfil',exact:true}).waitFor();
    console.log(`PASS ${width}px: original transparent logo loaded, nonblank pixels, aligned controls, no overflow, settings and profile work.`);
    await context.close();
  }
  assert.deepEqual(errors,[]);
} finally { await browser.close(); }
