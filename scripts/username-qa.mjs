import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Buffer } from 'node:buffer';
import { mkdir } from 'node:fs/promises';
import { initialUnit, learningUnits } from '../src/data/lessons.ts';
const {chromium}=createRequire(import.meta.url)('playwright');
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--no-proxy-server']});
const base=process.env.ARCA_QA_URL ?? 'http://localhost:8085';
const owner='00000000-0000-4000-8000-000000000097',date='2026-10-15T12:00:00.000Z';
const user={id:owner,email:'username@example.test',aud:'authenticated',app_metadata:{provider:'email',providers:['email']},user_metadata:{display_name:'Nome antigo'},identities:[],created_at:date};
const token=['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',Buffer.from(JSON.stringify({sub:owner,email:user.email,role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'fake-username-signature'].join('.');
const session={access_token:token,refresh_token:'username-test-refresh',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user};
const questions=initialUnit.lessons.flatMap(lesson=>lesson.questions.map(({id,type,prompt,explanation,...content},order_index)=>({id,type,prompt,explanation,content,order_index,lesson_id:lesson.id})));
await mkdir('artifacts/screenshots/username',{recursive:true});
const errors=[];
async function shot(page,name) {
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(img=>img.decode()));});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({animations:'disabled',path:`artifacts/screenshots/username/${name}.png`});
}
try {
  for(const width of JSON.parse(process.env.ARCA_QA_WIDTHS ?? '[320,390,430,1280]')) {
    const context=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce'});
    const profile={id:owner,display_name:'Nome antigo',username:'arca_'+owner.replaceAll('-',''),avatar_key:'dove',avatar_url:null,xp_total:148,current_streak:1,longest_streak:3,last_activity_date:'2026-10-15',created_at:date,updated_at:date};
    let patches=0,race=false;
    const friend={id:'friend-1',username:'amiga_arca',display_name:'@amiga_arca',avatar_key:'avatar-03',relationship:'friend'};
    await context.route('https://*.supabase.co/**',async route=>{
      const url=new URL(route.request().url()),path=url.pathname,body=route.request().postDataJSON();let payload;
      if(path.endsWith('/learning_username_available')) payload=body.p_username!=='ocupado';
      else if(path.endsWith('/profiles') && route.request().method()==='PATCH') {
        patches++;
        if(race) {race=false;await route.fulfill({status:400,contentType:'application/json',body:'{"code":"P0001","message":"username_taken"}'});return;}
        assert.equal(body.display_name,'@'+body.username);Object.assign(profile,body);payload=null;
      } else if(path.endsWith('/learning_leaderboard')) {const row={id:owner,display_name:profile.display_name,avatar_key:'dove',xp_total:148,position:1};payload={top:[row],current:row};}
      else if(path.endsWith('/learning_friends')) payload={friends:[friend],incoming:[],outgoing:[]};
      else if(path.endsWith('/search_learning_people')) {assert.equal(body.p_query,'amiga_arca');payload=[friend];}
      else if(path.endsWith('/units')) payload=learningUnits.map((unit,order_index)=>({id:unit.id,title:unit.title,course_id:'biblia-basica',order_index}));
      else if(path.endsWith('/lessons')) payload=learningUnits.flatMap(unit=>unit.lessons.map((lesson,order_index)=>({...lesson,unit_id:unit.id,order_index})));
      else if(path.endsWith('/questions')) payload=questions.slice(Number(url.searchParams.get('offset')??0),Number(url.searchParams.get('offset')??0)+Number(url.searchParams.get('limit')??1000));
      else if(path.endsWith('/learning_snapshot')) payload={unitId:initialUnit.id,xp:148,completedLessonIds:[],lastResult:null,guestImported:false,profile};
      else if(path.endsWith('/user')) payload=user;
      else if(path.endsWith('/lesson_attempts')) payload=[];
      else {await route.fulfill({status:503,contentType:'application/json',body:'{"error":"unexpected_qa_endpoint"}'});return;}
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload)});
    });
    await context.addInitScript(session=>{if(!localStorage.getItem('username-seeded')){localStorage.setItem('username-seeded','1');localStorage.setItem('sb-kuawynauynlyieocaahr-auth-token',JSON.stringify(session));}},session);
    const page=await context.newPage();page.setDefaultTimeout(60000);page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base+'/profile',{waitUntil:'domcontentloaded',timeout:120000});
    await page.getByRole('heading',{name:'Escolha seu nome de usuário',exact:true}).waitFor();
    await shot(page,`legacy-${width}`);
    await page.getByRole('button',{name:'Escolher depois',exact:true}).click();
    assert.equal(profile.display_name,'Nome antigo');assert.equal(patches,0);
    await page.getByRole('button',{name:'Escolher nome de usuário',exact:true}).click();
    const field=page.getByLabel('Nome de usuário',{exact:true});
    await field.fill('ocupado');await page.getByRole('button',{name:'Salvar nome de usuário',exact:true}).click();
    await page.getByText('Esse nome de usuário já está em uso. Escolha outro.',{exact:true}).waitFor();assert.equal(patches,0);
    await field.fill('@Matheus_Sakai');await page.getByRole('button',{name:'Salvar nome de usuário',exact:true}).click();
    await page.getByText('Nome de usuário atualizado.',{exact:true}).waitFor();assert.equal(profile.display_name,'@matheus_sakai');assert.equal(profile.xp_total,148);
    assert.equal(await page.getByText('@matheus_sakai',{exact:true}).count(),1);
    await page.getByRole('button',{name:'Editar perfil',exact:true}).click();await field.fill('novo_usuario');race=true;
    await page.getByRole('button',{name:'Salvar nome de usuário',exact:true}).click();await page.getByText('Esse nome de usuário já está em uso. Escolha outro.',{exact:true}).waitFor();
    assert.equal(profile.username,'matheus_sakai');await page.getByRole('button',{name:'Cancelar',exact:true}).click();
    await page.reload();await page.getByText('@matheus_sakai',{exact:true}).waitFor();assert.equal(await page.getByText('Escolha seu nome de usuário',{exact:true}).count(),0);
    await page.getByRole('button',{name:'Amigos',exact:true}).click();
    for(const query of ['amiga_arca','@amiga_arca']) {
      await page.getByLabel('Buscar por usuário',{exact:true}).fill(query);await page.getByRole('button',{name:'Buscar pessoas',exact:true}).click();await page.getByText('Resultados · 1',{exact:true}).waitFor();
    }
    await shot(page,`friends-${width}`);
    for(const row of await page.getByTestId('person-friend-1').all()) assert.equal(((await row.innerText()).match(/@amiga_arca/g)??[]).length,1);
    await page.goto(base+'/ranking');await page.getByTestId('podium-identity-1').waitFor();assert.match(await page.getByTestId('podium-identity-1').innerText(),/@matheus_sakai/);
    console.log(`PASS ${width}px: legacy prompt/later, one profile field, availability, race rejection, retained XP, persisted identity, ranking and search with/without @.`);
    await context.close();
  }
  const signup=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  let signups=0;
  await signup.route('https://*.supabase.co/**',async route=>{
    const path=new URL(route.request().url()).pathname,body=route.request().postDataJSON();
    if(path.endsWith('/learning_username_available')) {await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body.p_username!=='ocupado')});return;}
    if(path.endsWith('/signup')) {signups++;assert.deepEqual(body.data,{username:'nova_pessoa',display_name:'@nova_pessoa'});await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({user:{...user,id:'new-user',email:'new@example.test'},session:null})});return;}
    await route.fulfill({status:503,contentType:'application/json',body:'{}'});
  });
  const page=await signup.newPage();page.setDefaultTimeout(60000);await page.goto(base+'/signup');
  await page.getByLabel('Nome de usuário',{exact:true}).fill('ocupado');await page.getByLabel('E-mail',{exact:true}).fill('new@example.test');
  await page.getByLabel('Senha',{exact:true}).fill('Strong-password-123');await page.getByLabel('Confirmar senha',{exact:true}).fill('Strong-password-123');
  await page.getByRole('button',{name:'Criar minha conta',exact:true}).click();await page.getByText('Esse nome de usuário já está em uso. Escolha outro.',{exact:true}).waitFor();assert.equal(signups,0);
  await shot(page,'signup-taken-390');
  await page.getByLabel('Nome de usuário',{exact:true}).fill('@Nova_Pessoa');await page.getByRole('button',{name:'Criar minha conta',exact:true}).click();await page.waitForURL(/confirm-email/);assert.equal(signups,1);
  await signup.close();assert.deepEqual(errors,[]);console.log('PASS signup: duplicate prevented before Auth; unique normalized handle sent in registration metadata. No real emails/accounts.');
} finally {await browser.close();}
