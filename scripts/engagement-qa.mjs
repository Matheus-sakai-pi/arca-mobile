import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {Buffer} from 'node:buffer';
import {initialUnit,learningUnits} from '../src/data/lessons.ts';
const {chromium}=createRequire(import.meta.url)('playwright');
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--no-proxy-server']});
const base=process.env.ARCA_QA_URL??'http://localhost:8086';
const owner='00000000-0000-4000-8000-000000000096',friend='00000000-0000-4000-8000-000000000095',id='00000000-0000-4000-8000-000000000094';
const now=new Date().toISOString(),user={id:owner,email:'qa@example.test',aud:'authenticated',app_metadata:{provider:'email',providers:['email']},user_metadata:{display_name:'@aluno_teste'},identities:[],created_at:now};
const session={access_token:['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',Buffer.from(JSON.stringify({sub:owner,role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'fake-engagement-qa'].join('.'),refresh_token:'engagement-test-refresh',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user};
const rows=initialUnit.lessons.flatMap(lesson=>lesson.questions.map(({id,type,prompt,explanation,...content},order_index)=>({id,type,prompt,explanation,content,order_index,lesson_id:lesson.id})));
const play=initialUnit.lessons[0].questions;
const results=Array.from({length:5},(_,index)=>({attemptId:'summary-'+index,lessonId:initialUnit.lessons[0].id,correct:8,total:10,accuracy:80,xpEarned:index===0?31:0,completedAt:new Date(Date.now()-index*86400000).toISOString()}));
await mkdir('artifacts/screenshots/engagement',{recursive:true});const errors=[];
try{
  for(const width of [320,390,1280]){
    let items=[],submissions=0,firstAnswers=null,completedCount=1;
    const challenge=()=>({id,total:10,sender:friend,recipient:owner,friendName:'@amigo_teste',avatarKey:'avatar-03',status:'pending',myScore:null,theirScore:null,friendFinished:false,createdAt:now,expiresAt:new Date(Date.now()+7*86400000).toISOString()});
    const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
    await context.addInitScript(({session,owner})=>{localStorage.setItem('sb-kuawynauynlyieocaahr-auth-token',JSON.stringify(session));localStorage.setItem('arca.onboarding.v1','done');localStorage.setItem(`arca.preferences.${owner}.v1`,JSON.stringify({soundEnabled:false,hapticsEnabled:false,reduceMotion:true,dailyGoal:20}));},{session,owner});
    await context.route('https://*.supabase.co/**',async route=>{
      const url=new URL(route.request().url()),path=url.pathname,body=route.request().postDataJSON();let data;
      if(path.endsWith('/units'))data=learningUnits.map((unit,order_index)=>({id:unit.id,title:unit.title,course_id:'biblia-basica',order_index}));
      else if(path.endsWith('/lessons'))data=learningUnits.flatMap(unit=>unit.lessons.map((lesson,order_index)=>({...lesson,unit_id:unit.id,order_index})));
      else if(path.endsWith('/questions'))data=rows.slice(Number(url.searchParams.get('offset')??0),Number(url.searchParams.get('offset')??0)+Number(url.searchParams.get('limit')??1000));
      else if(path.endsWith('/learning_snapshot'))data={unitId:initialUnit.id,xp:31,completedLessonIds:initialUnit.lessons.slice(0,completedCount).map(lesson=>lesson.id),lastResult:{...results[0],lessonId:initialUnit.lessons[completedCount-1].id},guestImported:false,profile:{id:owner,display_name:'@aluno_teste',username:'aluno_teste',avatar_key:'dove',avatar_url:null,xp_total:31,current_streak:5,longest_streak:5,last_activity_date:now.slice(0,10),created_at:now,updated_at:now}};
      else if(path.endsWith('/user'))data=user;
      else if(path.endsWith('/lesson_attempts'))data=results.map(result=>({result}));
      else if(path.endsWith('/learning_friends'))data={friends:[{id:friend,username:'amigo_teste',display_name:'@amigo_teste',avatar_key:'avatar-03',relationship:'friend'}],incoming:[],outgoing:[]};
      else if(path.endsWith('/learning_challenges'))data={owner,items};
      else if(path.endsWith('/learning_challenge_create_ten')){assert.equal(body.p_friend,friend);assert.ok(body.p_key.length>=8);items=[{...challenge(),sender:owner,recipient:friend}];data=id;}
      else if(path.endsWith('/learning_challenge_action')){if(body.p_action==='cancel')items=[{...challenge(),status:'cancelled',sender:owner,recipient:friend}];else if(body.p_action==='accept')items[0].status='accepted';else throw new Error('Unexpected action');data={owner,items};}
      else if(path.endsWith('/learning_challenge_play'))data={owner,id,questions:play.map(({id,type,prompt,correctAnswer:_answer,explanation:_explanation,...content})=>({id,type,prompt,content}))};
      else if(path.endsWith('/learning_challenge_submit')){
        submissions++;assert.equal(Object.keys(body.p_answers).length,10);assert.equal('score' in body,false);
        if(submissions===1){firstAnswers=body.p_answers;await route.fulfill({status:503,json:{message:'offline'}});return;}
        assert.deepEqual(body.p_answers,firstAnswers);assert.deepEqual(body.p_answers,Object.fromEntries(play.map(q=>[q.id,q.correctAnswer])));items[0].myScore=10;items[0].theirScore=9;items[0].friendFinished=true;data={owner,items};
      }else throw new Error('Unexpected endpoint '+path);
      await route.fulfill({status:200,json:data});
    });
    const page=await context.newPage();page.setDefaultTimeout(60000);page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base+'/study/weekly',{waitUntil:'domcontentloaded',timeout:120000});
    await page.getByRole('heading',{name:'Resumo semanal',exact:true}).waitFor();await page.getByText('31 XP em novas lições neste período.',{exact:true}).waitFor();await page.screenshot({path:`artifacts/screenshots/engagement/weekly-${width}.png`});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.goto(base+'/study/reminders');await page.getByText('Disponível no aplicativo Android e iOS. Nenhum lembrete é enviado pela prévia web.',{exact:true}).waitFor();assert.equal(await page.getByRole('switch',{name:'Lembrete diário'}).isDisabled(),true);
    completedCount=2;await page.goto(base+'/lesson/result');await page.getByRole('heading',{name:'Lição concluída!',exact:true}).waitFor();await page.waitForTimeout(1300);assert.equal(await page.getByTestId('study-reminder-prompt').isVisible(),false);
    completedCount=3;await page.reload();await page.getByTestId('study-reminder-prompt').waitFor();await page.screenshot({path:`artifacts/screenshots/engagement/reminder-prompt-${width}.png`});
    await page.getByRole('button',{name:'Agora não',exact:true}).click();await page.getByTestId('study-reminder-prompt').waitFor({state:'hidden'});assert.equal(await page.evaluate(owner=>localStorage.getItem(`arca.reminder-prompt.${owner}.v1`),owner),'offered');
    await page.reload();await page.getByRole('heading',{name:'Lição concluída!',exact:true}).waitFor();await page.waitForTimeout(1300);assert.equal(await page.getByTestId('study-reminder-prompt').isVisible(),false);
    await page.evaluate(owner=>localStorage.removeItem(`arca.reminder-prompt.${owner}.v1`),owner);await page.reload();await page.getByTestId('study-reminder-prompt').waitFor();await page.getByRole('button',{name:'Escolher horário',exact:true}).click();await page.getByRole('switch',{name:'Lembrete diário'}).waitFor();assert.equal(new URL(page.url()).pathname,'/study/reminders');
    await page.goto(base+'/challenges');await page.getByRole('button',{name:'Desafiar amigo',exact:true}).click();await page.getByRole('button',{name:'Desafiar @amigo_teste',exact:true}).click();await page.getByText('Aguardando aceite',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Cancelar convite',exact:true}).click();await page.getByText('Convite cancelado',{exact:true}).waitFor();
    items=[challenge()];await page.getByRole('button',{name:'Atualizar desafios',exact:true}).click();await page.getByRole('button',{name:'Aceitar',exact:true}).click();await page.getByRole('button',{name:'Começar desafio',exact:true}).click();
    for(let n=0;n<10;n++){
      const question=play[n],value=question.correctAnswer;
      await page.getByText(`Pergunta ${n+1}/10`,{exact:true}).waitFor();
      if(question.type==='classify')for(const option of question.options){await page.getByRole('button',{name:option.label,exact:true}).click();await page.getByRole('button',{name:'Classificar em '+question.categories.find(item=>item.id===value[option.id]).label,exact:true}).click();}
      else if(question.type==='multi_select')for(const option of value)await page.getByRole('checkbox',{name:question.options.find(item=>item.id===option).label,exact:true}).click();
      else await page.getByRole(question.type==='spot_the_error'?'button':'radio',{name:question.options.find(option=>option.id===value).label,exact:true}).click();
      await page.getByRole('button',{name:'Próxima pergunta',exact:true}).click();
      if(n===2){await page.reload();await page.getByText('Pergunta 4/10',{exact:true}).waitFor();}
    }
    await page.getByRole('button',{name:'Enviar respostas',exact:true}).click();await page.getByText('Não foi possível concluir. Confira sua conexão e tente novamente.',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Enviar respostas',exact:true}).click();await page.getByRole('heading',{name:'Respostas recebidas',exact:true}).waitFor();await page.getByRole('button',{name:'Ver resultado',exact:true}).click();await page.getByText('Você venceu',{exact:true}).waitFor();
    await page.evaluate(async()=>{await Promise.all([...document.images].map(img=>img.decode().catch(()=>undefined)));});
    await page.screenshot({path:`artifacts/screenshots/engagement/challenges-${width}.png`});assert.equal(submissions,2);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.getByText('Você: 10/10 · @amigo_teste: 9/10',{exact:true}).waitFor();
    items=[{...challenge(),total:5,status:'accepted',myScore:4,theirScore:3,friendFinished:true}];await page.getByRole('button',{name:'Atualizar desafios',exact:true}).click();await page.getByText('Você: 4/5 · @amigo_teste: 3/5',{exact:true}).waitFor();
    await context.close();console.log(`PASS ${width}px: popup after three unique lessons, dismiss persisted, configure link, ten mixed questions, resume, retry, scores, legacy five-question display.`);
  }
  assert.deepEqual(errors,[]);
}finally{await browser.close();}
