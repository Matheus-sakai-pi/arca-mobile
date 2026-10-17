import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Buffer } from 'node:buffer';
import { mkdir } from 'node:fs/promises';
import { initialUnit, learningUnits } from '../src/data/lessons.ts';
const {chromium}=createRequire(import.meta.url)('playwright');
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--no-proxy-server']});
const base=process.env.ARCA_QA_URL ?? 'http://localhost:8085';
const owner='00000000-0000-4000-8000-000000000097',date='2026-10-15T12:00:00.000Z';
const user={id:owner,email:'social@example.test',aud:'authenticated',app_metadata:{provider:'email',providers:['email']},user_metadata:{display_name:'Matheus'},identities:[],created_at:date};
const token=['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',Buffer.from(JSON.stringify({sub:owner,email:user.email,role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'fake-social-signature'].join('.');
const session={access_token:token,refresh_token:'social-test-refresh',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user};
const questions=initialUnit.lessons.flatMap(lesson=>lesson.questions.map(({id,type,prompt,explanation,...content},order_index)=>({id,type,prompt,explanation,content,order_index,lesson_id:lesson.id})));
const person=(id,name,relationship)=>({id,username:id+'_arca',display_name:name,avatar_key:'avatar-03',relationship});
await mkdir('artifacts/screenshots/social',{recursive:true});
const errors=[];
async function shot(page,path) {
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(img=>img.decode()));});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No horizontal overflow');
  await page.screenshot({animations:'disabled',path:`artifacts/screenshots/social/${path}.png`});
}
try {
  for(const width of JSON.parse(process.env.ARCA_QA_WIDTHS ?? '[320,390,430,1280]')) {
    const context=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce'});
    let friends=[person('laura','Laura Oliveira','friend')],incoming=[person('miguel','Miguel Santos','incoming'),person('bia','Beatriz Almeida','incoming')],outgoing=[person('ana','Ana Carolina Lima','outgoing')];
    let offline=false,holdWeekly=null,releaseWeekly,weeklyStarted;
    const candidate=person('rafael','Rafael Costa','none');
    const lists=()=>({friends,incoming,outgoing});
    const leaderboard=scope=>{
      const names=scope==='weekly' ? ['Miguel Santos','Laura Oliveira','Matheus'] : scope==='friends' ? ['Matheus',...friends.map(p=>p.display_name)] : ['Matheus','Laura Oliveira','Miguel Santos','Ana Carolina Lima'];
      const top=names.map((name,index)=>({id:name==='Matheus' ? owner : 'rank-'+index,display_name:name,avatar_key:name==='Matheus' ? 'dove' : 'avatar-03',xp_total:scope==='weekly' ? 70-index*20 : 148-index*20,position:index+1}));
      return {top,current:top.find(p=>p.id===owner),...(scope==='weekly' ? {period:{start:'2026-10-12T03:00:00Z',end:'2026-10-19T03:00:00Z'}} : {})};
    };
    await context.route('https://*.supabase.co/**',async route=>{
      const url=new URL(route.request().url()),path=url.pathname,body=route.request().postDataJSON();let payload;
      if(path.endsWith('/learning_leaderboard_scope')) {
        if(body.p_scope==='weekly' && holdWeekly) {weeklyStarted();await holdWeekly;}
        payload=leaderboard(body.p_scope);
      } else if(path.endsWith('/learning_leaderboard')) payload=leaderboard('total');
      else if(path.endsWith('/learning_friends')) {
        if(offline) {await route.fulfill({status:503,contentType:'application/json',body:'{"message":"offline"}'});return;}
        payload=lists();
      } else if(path.endsWith('/search_learning_people')) payload=body.p_query.startsWith('raf') ? [candidate] : [];
      else if(path.endsWith('/learning_friend_action')) {
        const known=[...friends,...incoming,...outgoing,candidate].find(p=>p.id===body.p_person);assert.ok(known);
        friends=friends.filter(p=>p.id!==known.id);incoming=incoming.filter(p=>p.id!==known.id);outgoing=outgoing.filter(p=>p.id!==known.id);
        if(body.p_action==='request') outgoing.push({...known,relationship:'outgoing'});
        if(body.p_action==='accept') friends.push({...known,relationship:'friend'});
        payload=lists();
      } else if(path.endsWith('/units')) payload=learningUnits.map((unit,order_index)=>({id:unit.id,title:unit.title,course_id:'biblia-basica',order_index}));
      else if(path.endsWith('/lessons')) payload=learningUnits.flatMap(unit=>unit.lessons.map((lesson,order_index)=>({...lesson,unit_id:unit.id,order_index})));
      else if(path.endsWith('/questions')) payload=questions.slice(Number(url.searchParams.get('offset')??0),Number(url.searchParams.get('offset')??0)+Number(url.searchParams.get('limit')??1000));
      else if(path.endsWith('/learning_snapshot')) payload={unitId:initialUnit.id,xp:148,completedLessonIds:[],lastResult:null,guestImported:false,profile:{id:owner,display_name:'@matheus_arca',username:'matheus_arca',avatar_key:'dove',avatar_url:null,xp_total:148,current_streak:1,longest_streak:3,last_activity_date:'2026-10-15',created_at:date,updated_at:date}};
      else if(path.endsWith('/user')) payload=user;
      else if(path.endsWith('/lesson_attempts')) payload=[];
      else {await route.fulfill({status:503,contentType:'application/json',body:'{"error":"unexpected_qa_endpoint"}'});return;}
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload)});
    });
    await context.addInitScript(session=>{if(!localStorage.getItem('social-seeded')){localStorage.setItem('social-seeded','1');localStorage.setItem('sb-kuawynauynlyieocaahr-auth-token',JSON.stringify(session));}},session);
    const page=await context.newPage();page.setDefaultTimeout(60000);page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base+'/ranking',{waitUntil:'domcontentloaded',timeout:120000});
    await page.getByTestId('leaderboard-podium').waitFor();
    await page.getByRole('tab',{name:'XP SEMANAL',exact:true}).click();
    await page.getByText('12/10 a 18/10 · Horário de Brasília',{exact:true}).waitFor();
    assert.match(await page.getByTestId('podium-identity-1').innerText(),/Miguel Santos/);
    await shot(page,`weekly-${width}`);
    await page.getByRole('tab',{name:'AMIGOS',exact:true}).click();await page.getByRole('button',{name:'Gerenciar amigos',exact:true}).waitFor();
    await page.getByTestId('podium-identity-2').waitFor();await shot(page,`friends-ranking-${width}`);
    await page.getByRole('button',{name:'Gerenciar amigos',exact:true}).click();await page.getByText('Pedidos recebidos · 2',{exact:true}).waitFor();
    await shot(page,`friends-${width}`);
    await page.getByLabel('Buscar por usuário',{exact:true}).fill('rafael');await page.getByRole('button',{name:'Buscar pessoas',exact:true}).click();
    await page.getByRole('button',{name:'Adicionar Rafael Costa',exact:true}).click();await page.getByText('Pedidos enviados · 2',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Cancelar pedido de Rafael Costa',exact:true}).click();await page.getByText('Pedidos enviados · 1',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Aceitar Miguel Santos',exact:true}).click();await page.getByText('Meus amigos · 2',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Recusar Beatriz Almeida',exact:true}).click();await page.getByText('Pedidos recebidos · 1',{exact:true}).waitFor({state:'hidden'});
    await page.getByRole('button',{name:'Remover Laura Oliveira',exact:true}).click();await page.getByRole('button',{name:'Cancelar',exact:true}).click();assert.equal(friends.length,2);
    await page.getByRole('button',{name:'Remover Laura Oliveira',exact:true}).click();await page.getByRole('button',{name:'Remover amizade',exact:true}).click();await page.getByText('Meus amigos · 1',{exact:true}).waitFor();
    await page.getByLabel('Buscar por usuário',{exact:true}).fill('inexistente');await page.getByRole('button',{name:'Buscar pessoas',exact:true}).click();await page.getByText('Nenhuma pessoa encontrada para @inexistente.',{exact:true}).waitFor();
    offline=true;await page.getByRole('button',{name:'Atualizar amigos',exact:true}).click();await page.getByText('Não foi possível acessar seus amigos. Confira a conexão e tente novamente.',{exact:true}).waitFor();assert.equal(await page.getByTestId('person-miguel').count(),1);
    offline=false;await page.getByRole('button',{name:'Atualizar amigos',exact:true}).click();await page.getByText('Não foi possível acessar seus amigos. Confira a conexão e tente novamente.',{exact:true}).waitFor({state:'hidden'});
    await page.getByRole('button',{name:'Voltar',exact:true}).click();await page.getByTestId('leaderboard-podium').waitFor();
    await page.getByRole('tab',{name:'XP TOTAL',exact:true}).click();await page.getByTestId('podium-identity-1').waitFor();
    const started=new Promise(resolve=>{weeklyStarted=resolve;});holdWeekly=new Promise(resolve=>{releaseWeekly=resolve;});
    await page.getByRole('tab',{name:'XP SEMANAL',exact:true}).click();await started;
    await page.getByRole('tab',{name:'XP TOTAL',exact:true}).click();await page.getByTestId('podium-identity-1').waitFor();releaseWeekly();holdWeekly=null;
    assert.equal(await page.getByRole('tab',{name:'XP TOTAL',exact:true}).getAttribute('aria-selected'),'true');
    assert.match(await page.getByTestId('podium-identity-1').innerText(),/@matheus_arca/);
    await page.goto(base+'/profile');await page.getByRole('button',{name:'Amigos',exact:true}).click();await page.getByText('Meus amigos · 1',{exact:true}).waitFor();
    console.log(`PASS ${width}px: weekly/friends/total, stale scope response, profile entry, search, request/cancel, accept/decline, remove confirmation, offline/retry.`);
    await context.close();
  }
  const guest=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  await guest.addInitScript(()=>{localStorage.setItem('arca.visitor','active');localStorage.setItem('arca.onboarding.v1','done');});
  let socialReads=0;
  await guest.route('https://*.supabase.co/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path.endsWith('/learning_friends') || path.endsWith('/learning_friend_action')) socialReads++;
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(path.endsWith('/learning_leaderboard') ? {top:[],current:null} : [])});
  });
  const visitor=await guest.newPage();
  await visitor.goto(base+'/ranking');await visitor.getByRole('tab',{name:'AMIGOS',exact:true}).click();
  await visitor.getByText('Estude com seus amigos',{exact:true}).waitFor();assert.equal(socialReads,0);
  await visitor.goto(base+'/friends');await visitor.getByText('Uma jornada em boa companhia',{exact:true}).waitFor();
  assert.equal(await visitor.getByLabel('Buscar por usuário',{exact:true}).count(),0);assert.equal(socialReads,0);
  await guest.close();console.log('PASS guest: no private social RPC or friend search without a signed-in account.');
  assert.deepEqual(errors,[]);
} finally {await browser.close();}
