import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { initialUnit } from '../src/data/lessons.ts';
import { wrongAnswer } from '../tests/learningFixtures.ts';
const {chromium}=createRequire(import.meta.url)('playwright');
const base=process.env.ARCA_QA_URL ?? 'http://127.0.0.1:8084';
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--no-proxy-server']});
const errors=[];
const lesson=initialUnit.lessons[0];
await mkdir('artifacts/screenshots/study',{recursive:true});
async function verify(page,question,value) {
  await page.getByText(question.prompt,{exact:true}).filter({visible:true}).first().waitFor();
  if(question.type === 'classify') {
    for(const option of question.options) {
      await page.getByRole('button',{name:option.label,exact:true}).click();
      await page.getByRole('button',{name:'Classificar em '+question.categories.find(item=>item.id === value[option.id]).label,exact:true}).click();
    }
  } else if(question.type === 'multi_select') {
    for(const id of value)await page.getByRole('checkbox',{name:question.options.find(option=>option.id === id).label,exact:true}).click();
  } else await page.getByRole(question.type === 'spot_the_error' ? 'button' : 'radio',{name:question.options.find(option=>option.id === value).label,exact:true}).click();
  await page.getByRole('button',{name:'Verificar',exact:true}).click();
  await page.getByRole('button',{name:'Continuar',exact:true}).waitFor();
}
async function dismissReward(page) {
  const title=page.getByText('Conquista desbloqueada!',{exact:true});
  await title.waitFor({state:'visible',timeout:5000}).catch(()=>{});
  while(await title.isVisible()) {
    await page.getByRole('button',{name:'Continuar',exact:true}).filter({visible:true}).last().click();
    await title.waitFor({state:'hidden',timeout:3000}).catch(()=>{});
  }
}
try {
  for(const width of JSON.parse(process.env.ARCA_QA_WIDTHS ?? '[320,390,430]')) {
    const context=await browser.newContext({viewport:{width,height:width === 320 ? 640 : 844},reducedMotion:'reduce'});
    await context.route('https://*.supabase.co/**',route=>route.fulfill({status:503,contentType:'application/json',body:'{"error":"offline_qa"}'}));
    const page=await context.newPage();
    page.setDefaultTimeout(60000);page.setDefaultNavigationTimeout(120000);
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base,{waitUntil:'domcontentloaded',timeout:120000});
    await page.getByRole('button',{name:'Já tenho uma conta',exact:true}).waitFor({timeout:120000});
    await page.getByRole('button',{name:'Já tenho uma conta',exact:true}).click();
    await page.getByRole('button',{name:'Continuar sem conta',exact:true}).click();
    await page.getByRole('button',{name:'Abrir meu perfil'}).waitFor();
    await page.getByRole('button',{name:'Continuar',exact:true}).click();
    await verify(page,lesson.questions[0],wrongAnswer(lesson.questions[0]));
    await page.getByText('Quase!',{exact:true}).waitFor();
    const attempt=await page.evaluate(id=>JSON.parse(localStorage.getItem('arca.study.guest.v1')).drafts[id].attemptId,lesson.id);
    await page.getByRole('button',{name:'Sair da lição',exact:true}).click();
    await page.getByRole('button',{name:'Salvar e sair',exact:true}).click();
    await page.goto(base+'/home');
    await page.getByRole('button',{name:'Retomar: '+lesson.title,exact:true}).waitFor();
    await page.reload();
    await page.getByRole('button',{name:'Retomar: '+lesson.title,exact:true}).click();
    await page.getByText('Quase!',{exact:true}).waitFor();
    assert.equal(await page.evaluate(id=>JSON.parse(localStorage.getItem('arca.study.guest.v1')).drafts[id].attemptId,lesson.id),attempt);
    await page.screenshot({path:`artifacts/screenshots/study/resume-${width}.png`});
    await page.getByRole('button',{name:'Continuar',exact:true}).click();
    for(const question of lesson.questions.slice(1)) {await verify(page,question,question.correctAnswer);await page.getByRole('button',{name:'Continuar',exact:true}).click();}
    await page.getByText('Revisão · 1 pendente',{exact:true}).waitFor();
    await verify(page,lesson.questions[0],lesson.questions[0].correctAnswer);
    await page.getByRole('button',{name:'Continuar',exact:true}).click();
    await page.getByRole('heading',{name:'Lição concluída!',exact:true}).waitFor();
    assert.match(await page.locator('body').innerText(),/9\/10/);
    await page.getByRole('button',{name:'Continuar',exact:true}).click();
    await page.goto(base+'/home');
    await page.getByRole('button',{name:'Configurações',exact:true}).waitFor();
    await dismissReward(page);
    await page.getByText('10/10',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Configurações',exact:true}).click();
    await page.getByRole('radio',{name:'20 exercícios por dia',exact:true}).click();
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('arca.preferences.guest.v1') ?? '{}').dailyGoal === 20);
    for(const [name,key,value] of [['Efeitos sonoros','soundEnabled',false],['Vibração','hapticsEnabled',false],['Reduzir animações','reduceMotion',true]]) {
      const control=page.getByRole('switch',{name,exact:true});
      await assert.doesNotReject(async()=>control.waitFor({state:'visible'}));
      await control.click();
      await page.waitForFunction(({key,value})=>JSON.parse(localStorage.getItem('arca.preferences.guest.v1') ?? '{}')[key] === value,{key,value});
    }
    await page.screenshot({animations:'disabled',path:`artifacts/screenshots/study/settings-${width}.png`});
    await page.getByRole('button',{name:'Fechar configurações',exact:true}).click();
    await page.reload();await page.getByText('10/20',{exact:true}).waitFor();
    const prefs=await page.evaluate(()=>JSON.parse(localStorage.getItem('arca.preferences.guest.v1')));
    assert.equal(prefs.soundEnabled,false);assert.equal(prefs.hapticsEnabled,false);assert.equal(prefs.reduceMotion,true);
    await page.getByRole('button',{name:'Histórico',exact:true}).click();
    await page.getByRole('heading',{name:'Histórico de estudo',exact:true}).waitFor();
    assert.match(await page.locator('body').innerText(),/9\/10 acertos · 90% · \+28 XP/);
    await page.screenshot({path:`artifacts/screenshots/study/history-${width}.png`});
    await page.goto(base+'/study/review');
    await page.getByRole('button',{name:'Revisar lição',exact:true}).waitFor();
    await page.getByRole('button',{name:'Revisar lição',exact:true}).click();
    for(const question of lesson.questions) {await verify(page,question,question.correctAnswer);await page.getByRole('button',{name:'Continuar',exact:true}).click();}
    await page.getByRole('heading',{name:'Lição concluída!',exact:true}).waitFor();
    const progress=await page.evaluate(()=>JSON.parse(localStorage.getItem('arca.learning.v1')));
    assert.equal(progress.xp,28);assert.equal(progress.lastResult.xpEarned,0);
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('arca.study.guest.v1')).history.length),2);
    await page.goto(base+'/support');
    await page.getByRole('heading',{name:'Ajuda e suporte',exact:true}).waitFor();
    assert.equal(await page.getByRole('switch',{name:'Incluir diagnóstico técnico',exact:true}).isChecked(),false);
    await page.screenshot({path:`artifacts/screenshots/study/support-${width}.png`});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth),false);
    console.log(`PASS ${width}px: paused feedback resumes, attempt ID preserved, 28 XP once, history, daily goal, settings persist, review adds zero XP, support opt-in.`);
    await context.close();
  }
  assert.deepEqual(errors,[]);
} finally {await browser.close();}
