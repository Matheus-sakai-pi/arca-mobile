import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import { initialUnit, learningUnits } from '../src/data/lessons.ts';
import { createProgress, completeLesson } from '../src/lib/learningProgress.ts';
import { createAttempt, reduceAttempt } from '../src/lib/lessonEngine.ts';
import { lessonFingerprint, localDay } from '../src/lib/studyStore.ts';
import { answersFor, wrongAnswer } from '../tests/learningFixtures.ts';

const {chromium}=createRequire(import.meta.url)('playwright');
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--no-proxy-server']});
const base=process.env.ARCA_QA_URL ?? 'http://localhost:8085';
const errors=[];
const oldDate=new Date(Date.now()-3*86400000).toISOString();
let progress=createProgress();
for(const [index,lesson] of initialUnit.lessons.slice(0,4).entries()) progress=completeLesson(progress,lesson,answersFor(lesson,9),`layout-${index}`,oldDate);
const resume=initialUnit.lessons[4];
const attempt=reduceAttempt(resume,reduceAttempt(resume,createAttempt(),{type:'answer',answer:wrongAnswer(resume.questions[0])}),{type:'verify'});
const study={version:1,scope:'guest',history:initialUnit.lessons.slice(0,1).map((lesson,index)=>({day:localDay(new Date(oldDate)),mistakes:[lesson.questions[0].id],result:{lessonId:lesson.id,attemptId:`layout-history-${index}`,correct:9,total:10,accuracy:90,xpEarned:28,completedAt:oldDate}})),drafts:{[resume.id]:{attemptId:'layout-resume',fingerprint:lessonFingerprint(resume),state:attempt,updatedAt:new Date().toISOString()}}};
await mkdir('artifacts/screenshots/action-layout',{recursive:true});

async function align(page,testId) {
  const block=page.getByTestId(testId);
  await block.evaluate(element=>{
    const scroll=element.closest('[data-testid="illustrated-scroll"]');
    scroll.scrollTop+=element.getBoundingClientRect().top-scroll.getBoundingClientRect().top-16;
  });
}
async function fit(page,locator) {
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  for(const button of await locator.getByRole('button').all()) {
    const box=await button.boundingBox();
    assert.ok(box.height>=48 && box.width>=48,'Controls retain comfortable touch targets');
    assert.equal(await button.evaluate(element=>element.scrollWidth>element.clientWidth+1),false,'Text fits within its row');
  }
}
try {
  for(const width of JSON.parse(process.env.ARCA_QA_WIDTHS ?? '[320,390,430,1280]')) {
    const guest=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce'});
    await guest.route('https://*.supabase.co/**',route=>route.fulfill({status:503,contentType:'application/json',body:'{"error":"offline_qa"}'}));
    const page=await guest.newPage(); page.setDefaultTimeout(60000);page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base,{waitUntil:'domcontentloaded',timeout:120000});
    await page.getByRole('button',{name:'Já tenho uma conta',exact:true}).click();
    await page.getByRole('button',{name:'Continuar sem conta',exact:true}).click();
    await page.getByTestId('home-brand-logo').waitFor();
    await page.evaluate(({progress,study})=>{
      localStorage.setItem('arca.learning.v1',JSON.stringify(progress));
      localStorage.setItem('arca.study.guest.v1',JSON.stringify(study));
      localStorage.setItem('arca.preferences.guest.v1',JSON.stringify({soundEnabled:false,hapticsEnabled:false,reduceMotion:true,dailyGoal:20}));
    },{progress,study});
    await page.reload();
    const summary=page.getByTestId('study-summary'); await summary.waitFor();
    await page.getByRole('button',{name:'Retomar: '+resume.title,exact:true}).waitFor();
    await align(page,'study-summary');
    await fit(page,summary);
    assert.equal(await summary.getByRole('progressbar',{name:'Meta diária'}).getAttribute('aria-valuenow'),'0');
    assert.equal(Math.round((await summary.getByRole('progressbar').boundingBox()).height),8);
    const review=await summary.getByRole('button',{name:'Revisão · 2',exact:true}).boundingBox();
    const history=await summary.getByRole('button',{name:'Histórico',exact:true}).boundingBox();
    assert.equal(review.y,history.y,'Secondary actions share one compact row');
    assert.ok(review.x+review.width<=history.x,'Actions never overlap');
    await page.screenshot({animations:'disabled',path:`artifacts/screenshots/action-layout/home-${width}.png`});
    await summary.getByRole('button',{name:'Retomar: '+resume.title,exact:true}).click();
    await page.getByText('Quase!',{exact:true}).waitFor();
    assert.equal(await page.evaluate(id=>JSON.parse(localStorage.getItem('arca.study.guest.v1')).drafts[id].attemptId,resume.id),'layout-resume');
    await page.goto(base+'/home');
    await page.getByRole('button',{name:'Revisão · 2',exact:true}).click();
    await page.waitForURL('**/study/review');
    await page.goto(base+'/home'); await page.getByRole('button',{name:'Histórico',exact:true}).click();
    await page.waitForURL('**/study/history');
    await page.goto(base+'/profile');
    await page.getByTestId('profile-actions').waitFor();
    assert.equal(await page.getByRole('button',{name:'Excluir conta',exact:true}).count(),0);
    await fit(page,page.getByTestId('profile-actions'));
    await align(page,'profile-actions');
    await page.screenshot({animations:'disabled',path:`artifacts/screenshots/action-layout/guest-${width}.png`});
    await guest.close();

    const account=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce'});
    const userId='00000000-0000-4000-8000-000000000098';
    const date='2026-10-15T12:00:00.000Z';
    const user={id:userId,email:'layout@example.test',aud:'authenticated',app_metadata:{provider:'email',providers:['email']},user_metadata:{display_name:'Conta de teste'},identities:[],created_at:date};
    const token=['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',Buffer.from(JSON.stringify({sub:userId,email:user.email,role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'fake-test-signature'].join('.');
    const session={access_token:token,refresh_token:'layout-test-refresh',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user};
    const profile={id:userId,display_name:'@teste_layout',username:'teste_layout',avatar_key:'learner',avatar_url:null,xp_total:0,current_streak:0,longest_streak:0,last_activity_date:null,created_at:date,updated_at:date};
    let resets=0,deleted=0,updates=0;
    const questions=initialUnit.lessons.flatMap(lesson=>lesson.questions.map(({id,type,prompt,explanation,...content},order_index)=>({id,type,prompt,explanation,content,order_index,lesson_id:lesson.id})));
    await account.route('https://*.supabase.co/**',async route=>{
      const url=new URL(route.request().url()),path=url.pathname;
      let data;
      if(path.endsWith('/units')) data=learningUnits.map((unit,order_index)=>({id:unit.id,title:unit.title,course_id:'biblia-basica',order_index}));
      else if(path.endsWith('/lessons')) data=learningUnits.flatMap(unit=>unit.lessons.map((lesson,order_index)=>({...lesson,unit_id:unit.id,order_index})));
      else if(path.endsWith('/questions')) data=questions.slice(Number(url.searchParams.get('offset')??0),Number(url.searchParams.get('offset')??0)+Number(url.searchParams.get('limit')??1000));
      else if(path.endsWith('/learning_snapshot')) data={unitId:initialUnit.id,xp:0,completedLessonIds:[],lastResult:null,guestImported:false,profile};
      else if(path.endsWith('/user')) data=user;
      else if(path.endsWith('/learning_username_available')) data=true;
      else if(path.endsWith('/profiles') && route.request().method()==='PATCH') {updates++;Object.assign(profile,route.request().postDataJSON());await route.fulfill({status:204});return;}
      else if(path.endsWith('/recover')) {resets++;data={};}
      else if(path.endsWith('/logout')) {await route.fulfill({status:204});return;}
      else if(path.endsWith('/lesson_attempts')) data=[];
      else if(path.endsWith('/delete-account')) {deleted++;throw new Error('Layout QA must never delete an account');}
      else {await route.fulfill({status:503,contentType:'application/json',body:'{"error":"unexpected_qa_endpoint"}'});return;}
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
    });
    await account.addInitScript(session=>{
      if(localStorage.getItem('layout-seeded'))return;
      localStorage.setItem('layout-seeded','1');
      localStorage.setItem('sb-kuawynauynlyieocaahr-auth-token',JSON.stringify(session));
    },session);
    const signed=await account.newPage();signed.setDefaultTimeout(60000);signed.on('pageerror',error=>errors.push(error.message));
    await signed.goto(base+'/profile',{waitUntil:'domcontentloaded',timeout:120000});
    const actions=signed.getByTestId('profile-actions');await actions.waitFor();
    const profileTitle=signed.getByRole('heading',{name:'Perfil',exact:true});
    const titleStyle=await profileTitle.evaluate(element=>{
      const style=getComputedStyle(element);
      return {fontFamily:style.fontFamily,fontSize:style.fontSize,lineHeight:style.lineHeight,color:style.color,shadow:style.textShadow,background:style.backgroundColor,parentBackground:getComputedStyle(element.parentElement).backgroundColor};
    });
    assert.match(titleStyle.fontFamily,/Nunito_800ExtraBold/);
    assert.equal(titleStyle.fontSize,'36px');assert.equal(titleStyle.lineHeight,'44px');
    assert.equal(titleStyle.color,'rgb(255, 255, 255)');assert.notEqual(titleStyle.shadow,'none');
    assert.equal(titleStyle.background,'rgba(0, 0, 0, 0)');assert.equal(titleStyle.parentBackground,'rgba(0, 0, 0, 0)');
    const titleBox=await profileTitle.boundingBox(),settingsBox=await signed.getByRole('button',{name:'Configurações',exact:true}).boundingBox();
    assert.ok(titleBox.x+titleBox.width<=settingsBox.x,'Title never overlaps settings');
    await signed.screenshot({animations:'disabled',path:`artifacts/screenshots/action-layout/profile-title-${width}.png`});
    await signed.getByRole('button',{name:'Editar perfil',exact:true}).waitFor({state:'visible'});
    await fit(signed,actions);await align(signed,'profile-actions');
    for(const title of ['Conta','Suporte','Sessão']) await actions.getByRole('heading',{name:title,exact:true}).waitFor();
    const deleteInk=await actions.getByText('Excluir conta',{exact:true}).evaluate(element=>getComputedStyle(element).color);
    assert.equal(deleteInk,'rgb(182, 46, 71)');
    await signed.screenshot({animations:'disabled',path:`artifacts/screenshots/action-layout/account-${width}.png`});
    await actions.getByRole('button',{name:'Editar perfil',exact:true}).click();
    await signed.getByLabel('Nome de usuário',{exact:true}).fill('nome_atualizado');
    await signed.getByRole('button',{name:'Salvar nome de usuário',exact:true}).click();
    await signed.getByText('Nome de usuário atualizado.',{exact:true}).waitFor(); assert.equal(updates,1);
    await signed.getByRole('button',{name:'Editar perfil',exact:true}).click();
    await signed.getByRole('button',{name:'Cancelar',exact:true}).click();
    await signed.getByRole('button',{name:'Alterar senha',exact:true}).click();
    const sent=signed.getByRole('button',{name:'E-mail de recuperação enviado',exact:true});await sent.waitFor();assert.equal(await sent.isDisabled(),true);assert.equal(resets,1);
    await fit(signed,actions);
    for(const [title,url] of [['Histórico de estudo','/study/history'],['Ajuda e suporte','/support'],['Política de Privacidade','/privacy'],['Excluir conta','/account/delete']]) {
      await signed.getByRole('button',{name:title,exact:true}).click();
      await signed.waitForURL('**'+url);
      if(url==='/account/delete') assert.equal(await signed.getByRole('button',{name:'Excluir minha conta',exact:true}).isDisabled(),true);
      await signed.getByRole('button',{name:'Voltar',exact:true}).click();
      await signed.getByTestId('profile-actions').waitFor();
    }
    assert.equal(deleted,0);
    await signed.getByRole('button',{name:'Sair da conta',exact:true}).click();
    await signed.waitForFunction(()=>!localStorage.getItem('sb-kuawynauynlyieocaahr-auth-token') && location.pathname!=='/profile');
    await account.close();
    console.log(`PASS ${width}px: compact goal/resume, aligned study actions, resumed draft preserved, guest/account rows, edit/save/cancel, password reset, routes and logout; no deletion.`);
  }
  assert.deepEqual(errors,[]);
} finally {await browser.close();}
