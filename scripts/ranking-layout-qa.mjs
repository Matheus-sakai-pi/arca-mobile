import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Buffer } from 'node:buffer';
import { mkdir } from 'node:fs/promises';
import { initialUnit, learningUnits } from '../src/data/lessons.ts';

const {chromium}=createRequire(import.meta.url)('playwright');
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--no-proxy-server']});
const base=process.env.ARCA_QA_URL ?? 'http://localhost:8085';
const errors=[];
const userId='00000000-0000-4000-8000-000000000097';
const date='2026-10-15T12:00:00.000Z';
const user={id:userId,email:'ranking@example.test',aud:'authenticated',app_metadata:{provider:'email',providers:['email']},user_metadata:{display_name:'Matheus'},identities:[],created_at:date};
const token=['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',Buffer.from(JSON.stringify({sub:userId,email:user.email,role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'fake-ranking-signature'].join('.');
const session={access_token:token,refresh_token:'ranking-test-refresh',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user};
const questions=initialUnit.lessons.flatMap(lesson=>lesson.questions.map(({id,type,prompt,explanation,...content},order_index)=>({id,type,prompt,explanation,content,order_index,lesson_id:lesson.id})));
const names=['Matheus','Laura Oliveira','Miguel Santos','Ana Carolina Lima','Rafael Costa','Beatriz Almeida','Pedro Souza','Mariana Lima','Lucas Ferreira','Isabela Rocha'];
const avatars=['dove','avatar-03','avatar-02','avatar-05','avatar-01','avatar-04','owl','lamb','fox','turtle'];
await mkdir('artifacts/screenshots/ranking-layout',{recursive:true});

async function assets(page) {
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(img=>img.decode()));});
}
async function geometry(page,count) {
  const podium=page.getByTestId('leaderboard-podium');
  await page.waitForFunction(count=>{
    const rect=id=>document.querySelector(`[data-testid="${id}"]`)?.getBoundingClientRect();
    for(let rank=1;rank<=Math.min(3,count);rank++) {
      const a=rect(`podium-avatar-${rank}`),p=rect(`podium-pedestal-${rank}`),i=rect(`podium-identity-${rank}`);
      if(!a || !p || !i || a.bottom>p.top+1 || p.top-a.bottom>8 || i.bottom>p.bottom+1) return false;
      const n=document.querySelector(`[data-testid="podium-rank-${rank}"] [dir="auto"]`)?.getBoundingClientRect();
      if(!n || n.top<p.top+p.height*[0.16,0.31,0.25][rank-1]-1 || n.bottom>i.top+1) return false;
    }
    return true;
  },count);
  const measured=await podium.evaluate((element,count)=>{
    const rect=(id,suffix='')=>{const r=element.querySelector(`[data-testid="${id}"]${suffix}`).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
    return Array.from({length:Math.min(3,count)},(_,index)=>({avatar:rect(`podium-avatar-${index+1}`),pedestal:rect(`podium-pedestal-${index+1}`),identity:rect(`podium-identity-${index+1}`),art:rect(`podium-art-${index+1}`),number:rect(`podium-rank-${index+1}`,' [dir="auto"]')}));
  },count);
  const positions=[];
  for(let rank=1;rank<=Math.min(3,count);rank++) {
    const {avatar,pedestal,identity,art,number}=measured[rank-1];
    assert.ok(avatar && pedestal && identity && art);
    assert.ok(Math.abs(art.width-pedestal.width)<1 && Math.abs(art.height-pedestal.height)<1);
    assert.ok(avatar.y+avatar.height<=pedestal.y+1 && pedestal.y-avatar.y-avatar.height<=8);
    assert.ok(identity.y+identity.height<=pedestal.y+pedestal.height+1,'Names and XP remain inside the pedestal');
    assert.equal(await page.getByTestId(`podium-identity-${rank}`).evaluate(element=>element.scrollHeight>element.clientHeight+1),false);
    assert.ok(number.y>=pedestal.y+pedestal.height*[0.16,0.31,0.25][rank-1]-1,'Rank clears the bitmap rim');
    assert.ok(number.y+number.height<=identity.y+1,'Rank stays above the participant name');
    assert.ok(Math.abs(number.x+number.width/2-pedestal.x-pedestal.width/2)<1,'Rank is horizontally centered');
    positions.push(pedestal);
  }
  if(positions.length>1) {
    const bases=positions.map(box=>box.y+box.height);
    assert.ok(Math.max(...bases)-Math.min(...bases)<1,'Podium bases align');
    assert.ok(positions[0].y<positions[1].y);
    if(positions[2]) assert.ok(positions[1].y<positions[2].y);
  }
  assert.equal(await page.locator('[data-testid^="podium-pedestal-"]').count(),Math.min(3,count));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  const panel=await page.getByTestId('ranking-stats').boundingBox();
  assert.ok(panel.width<=Math.min(480,page.viewportSize().width)-32+1,'Stats fit within app width');
  assert.ok(panel.height<=70,'Ranking stats retain the compact height');
  const paint=await page.getByTestId('podium-art-1').locator('img').evaluate(img=>{
    const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;
    const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,32,32);
    return [...ctx.getImageData(0,0,32,32).data].filter((value,index)=>index%4===3 && value>128).length;
  });
  assert.ok(paint>300,'Real pedestal bitmap renders nonblank');
  return podium;
}
try {
  for(const width of JSON.parse(process.env.ARCA_QA_WIDTHS ?? '[320,390,430,1280]')) {
    const context=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce'});
    let count=10,ownRank=1,longNames=false,fail=false,calls=0;
    let hold=null,started=null;
    function data() {
      const top=Array.from({length:count},(_,index)=>({id:index+1===ownRank ? userId : `test-${index+1}`,position:index+1,display_name:longNames && index<3 ? 'Maria Fernanda de Albuquerque e Vasconcelos' : names[index],avatar_key:avatars[index],xp_total:longNames ? 999999-index*1000 : 2540-index*200}));
      const current=top.find(row=>row.id===userId) ?? (ownRank>10 ? {id:userId,position:ownRank,display_name:'Matheus',avatar_key:'dove',xp_total:148} : null);
      return {top,current};
    }
    await context.route('https://*.supabase.co/**',async route=>{
      const url=new URL(route.request().url()),path=url.pathname;
      let payload;
      if(path.endsWith('/learning_leaderboard')) {
        calls++;
        if(started) {started();started=null;}
        if(hold) await hold;
        if(fail) {await route.fulfill({status:503,contentType:'application/json',body:'{"error":"ranking_qa_offline"}'});return;}
        payload=data();
      } else if(path.endsWith('/units')) payload=learningUnits.map((unit,order_index)=>({id:unit.id,title:unit.title,course_id:'biblia-basica',order_index}));
      else if(path.endsWith('/lessons')) payload=learningUnits.flatMap(unit=>unit.lessons.map((lesson,order_index)=>({...lesson,unit_id:unit.id,order_index})));
      else if(path.endsWith('/questions')) {const offset=Number(url.searchParams.get('offset')??0);payload=questions.slice(offset,offset+Number(url.searchParams.get('limit')??1000));}
      else if(path.endsWith('/learning_snapshot')) {
        const me=data().current;
        payload={unitId:initialUnit.id,xp:me?.xp_total??0,completedLessonIds:[],lastResult:null,guestImported:false,profile:{id:userId,display_name:'@ranking_teste',username:'ranking_teste',avatar_key:me?.avatar_key??'dove',avatar_url:null,xp_total:me?.xp_total??0,current_streak:1,longest_streak:3,last_activity_date:'2026-10-15',created_at:date,updated_at:date}};
      } else if(path.endsWith('/user')) payload=user;
      else if(path.endsWith('/lesson_attempts')) payload=[];
      else {await route.fulfill({status:503,contentType:'application/json',body:'{"error":"unexpected_qa_endpoint"}'});return;}
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload)});
    });
    await context.addInitScript(session=>{
      if(localStorage.getItem('ranking-seeded'))return;
      localStorage.setItem('ranking-seeded','1');
      localStorage.setItem('sb-kuawynauynlyieocaahr-auth-token',JSON.stringify(session));
    },session);
    const page=await context.newPage();page.setDefaultTimeout(60000);page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base+'/ranking',{waitUntil:'domcontentloaded',timeout:120000});
    await page.getByTestId('leaderboard-podium').waitFor();await assets(page);
    const podium=await geometry(page,count);
    const title=page.getByRole('heading',{name:'Ranking',exact:true});
    assert.equal(await title.evaluate(element=>getComputedStyle(element).color),'rgb(255, 255, 255)');
    for(const name of ['XP TOTAL','XP SEMANAL','AMIGOS']) assert.equal(await page.getByRole('tab',{name,exact:true}).count(),1);
    await page.screenshot({animations:'disabled',path:`artifacts/screenshots/ranking-layout/top-${width}.png`});
    await podium.screenshot({animations:'disabled',path:`artifacts/screenshots/ranking-layout/podium-${width}.png`});
    await page.getByTestId('leaderboard-row-4').scrollIntoViewIfNeeded();
    const rows=page.getByTestId('leaderboard-list').locator('[data-testid^="leaderboard-row-"]');
    assert.equal(await rows.count(),7);
    for(const row of await rows.all()) assert.equal(await row.evaluate(element=>getComputedStyle(element).borderRadius),'0px');
    await page.screenshot({animations:'disabled',path:`artifacts/screenshots/ranking-layout/list-${width}.png`});
    for(const rank of [2,3,7,37]) {
      ownRank=rank;
      await page.reload();await page.getByTestId('leaderboard-podium').waitFor();await assets(page);await geometry(page,count);
      if(rank>10) {assert.equal(await page.getByTestId('leaderboard-row-37').count(),1);await page.getByText('Sua posição',{exact:true}).waitFor();}
      else if(rank<=3) assert.match(await page.getByTestId(`podium-identity-${rank}`).innerText(),/Você/);
      else assert.match(await page.getByTestId(`leaderboard-row-${rank}`).innerText(),/Você/);
    }
    ownRank=1;longNames=true;
    await page.reload();await page.getByTestId('leaderboard-podium').waitFor();await assets(page);await geometry(page,count);
    await page.getByTestId('leaderboard-podium').screenshot({animations:'disabled',path:`artifacts/screenshots/ranking-layout/long-names-${width}.png`});
    longNames=false;
    for(const size of [1,2,0]) {
      count=size;await page.reload();
      if(size) {await page.getByTestId('leaderboard-podium').waitFor();await assets(page);await geometry(page,size);}
      else {await page.getByText('A jornada está começando',{exact:true}).waitFor();assert.equal(await page.getByTestId('leaderboard-podium').count(),0);}
    }
    count=10;await page.reload();await page.getByTestId('leaderboard-podium').waitFor();
    const before=calls;let release;
    hold=new Promise(resolve=>{release=resolve;});
    const inFlight=new Promise(resolve=>{started=resolve;});
    await page.getByRole('button',{name:'Atualizar ranking',exact:true}).click();await inFlight;
    assert.equal(await page.getByRole('button',{name:'Atualizar ranking',exact:true}).isDisabled(),true);
    fail=true;release();hold=null;
    await page.getByText('Não foi possível atualizar o ranking. Confira sua conexão e tente novamente.',{exact:true}).waitFor();
    assert.equal(await page.getByTestId('leaderboard-podium').count(),1,'Cached ranking remains visible after a refresh error');
    fail=false;await page.getByRole('button',{name:'Atualizar ranking',exact:true}).click();
    await page.getByText('Não foi possível atualizar o ranking. Confira sua conexão e tente novamente.',{exact:true}).waitFor({state:'hidden'});
    assert.ok(calls>before);
    console.log(`PASS ${width}px: podium geometry, long names, all own-user locations, one/two/zero participants, flat rows, real assets, refresh busy/error/retry.`);
    await context.close();
  }
  assert.deepEqual(errors,[]);
} finally {await browser.close();}
