import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {Buffer} from 'node:buffer';
import {initialUnit,learningUnits} from '../src/data/lessons.ts';
const {chromium}=createRequire(import.meta.url)('playwright');
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--no-proxy-server']});
const base=process.env.ARCA_QA_URL??'http://localhost:8085',dashboard='http://localhost:8090';
const owner='00000000-0000-4000-8000-000000000096',admin='00000000-0000-4000-8000-000000000097';
const now=new Date().toISOString();
function sessionFor(id){const user={id,email:'qa@example.test',aud:'authenticated',app_metadata:{provider:'email',providers:['email']},user_metadata:{display_name:'@aluno_teste'},identities:[],created_at:now};return {access_token:['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',Buffer.from(JSON.stringify({sub:id,role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'fake-report-qa-signature'].join('.'),refresh_token:'report-test-refresh',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user};}
const session=sessionFor(owner);
const questions=initialUnit.lessons.flatMap(lesson=>lesson.questions.map(({id,type,prompt,explanation,...content},order_index)=>({id,type,prompt,explanation,content,order_index,lesson_id:lesson.id})));
await mkdir('artifacts/screenshots/reports',{recursive:true});
const errors=[];
try{
  for(const width of [320,390,1280]){
    let submissions=0,firstKey,report=null;
    const context=await browser.newContext({viewport:{width,height:760},reducedMotion:'reduce'});
    await context.addInitScript(({session,owner})=>{localStorage.setItem('sb-kuawynauynlyieocaahr-auth-token',JSON.stringify(session));localStorage.setItem('arca.onboarding.v1','done');localStorage.setItem(`arca.preferences.${owner}.v1`,JSON.stringify({soundEnabled:false,hapticsEnabled:false,reduceMotion:true,dailyGoal:20}));},{session,owner});
    await context.route('https://*.supabase.co/**',async route=>{
      const url=new URL(route.request().url()),path=url.pathname,body=route.request().postDataJSON();let data;
      if(path.endsWith('/units'))data=learningUnits.map((unit,order_index)=>({id:unit.id,title:unit.title,course_id:'biblia-basica',order_index}));
      else if(path.endsWith('/lessons'))data=learningUnits.flatMap(unit=>unit.lessons.map((lesson,order_index)=>({...lesson,unit_id:unit.id,order_index})));
      else if(path.endsWith('/questions'))data=questions.slice(Number(url.searchParams.get('offset')??0),Number(url.searchParams.get('offset')??0)+Number(url.searchParams.get('limit')??1000));
      else if(path.endsWith('/learning_snapshot'))data={unitId:initialUnit.id,xp:0,completedLessonIds:[],lastResult:null,guestImported:false,profile:{id:owner,display_name:'@aluno_teste',username:'aluno_teste',avatar_key:'dove',avatar_url:null,xp_total:0,current_streak:0,longest_streak:0,last_activity_date:null,created_at:now,updated_at:now}};
      else if(path.endsWith('/user'))data=session.user;
      else if(path.endsWith('/lesson_attempts'))data=[];
      else if(path.endsWith('/start_learning_lesson'))data=null;
      else if(path.endsWith('/record_study_session'))data=null;
      else if(path.endsWith('/submit_question_report')){
        submissions++;assert.equal(body.p_lesson,initialUnit.lessons[0].id);assert.equal(body.p_question,initialUnit.lessons[0].questions[0].id);assert.equal(body.p_reason,'answer');assert.equal(body.p_comment,'Quero conferir esta resposta.');assert.equal(body.p_platform,'web');
        assert.equal('reporterId' in body,false);assert.equal('question_snapshot' in body,false);
        if(submissions===1){firstKey=body.p_request_key;await route.fulfill({status:503,json:{message:'offline'}});return;}
        assert.equal(body.p_request_key,firstKey,'Retry preserves submission identity');
        report={id:'00000000-0000-4000-8000-000000000055',lessonId:body.p_lesson,questionId:body.p_question,lessonTitle:initialUnit.lessons[0].title,question:initialUnit.lessons[0].questions[0],reason:body.p_reason,comment:body.p_comment,version:body.p_version,platform:body.p_platform,status:'new',createdAt:now,updatedAt:now,reporter:'@aluno_teste',questionReports:1};
        data={id:report.id,reporterId:owner,received:true,duplicate:false};
      }else throw new Error('Unexpected endpoint '+path);
      await route.fulfill({status:200,json:data});
    });
    const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(60000);
    await page.goto(base+'/lesson/'+initialUnit.lessons[0].id,{waitUntil:'domcontentloaded',timeout:120000});
    const answer=page.getByRole('radio',{name:'Uma coleção de livros',exact:true});await answer.click();
    const trigger=page.getByRole('button',{name:'Reportar problema na pergunta',exact:true});await trigger.click();
    await page.getByRole('heading',{name:'Reportar problema',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Enviar relato',exact:true}).isDisabled(),true);
    await page.getByRole('radio',{name:'Resposta incorreta',exact:true}).click();await page.getByLabel('Comentário do relato',{exact:true}).fill('Quero conferir esta resposta.');
    await page.screenshot({path:`artifacts/screenshots/reports/form-${width}.png`});
    await page.getByRole('button',{name:'Enviar relato',exact:true}).click();await page.getByText('Não foi possível concluir. Confira a conexão e tente novamente.',{exact:true}).waitFor();assert.equal(report,null);
    assert.equal(await page.getByLabel('Comentário do relato',{exact:true}).inputValue(),'Quero conferir esta resposta.');
    await page.getByRole('button',{name:'Enviar relato',exact:true}).click();await page.getByRole('heading',{name:'Relato recebido',exact:true}).waitFor();assert.equal(submissions,2);
    await page.screenshot({path:`artifacts/screenshots/reports/received-${width}.png`});
    await page.getByRole('button',{name:'Voltar à lição',exact:true}).click();assert.equal(await answer.isChecked(),true);assert.match(await page.locator('body').innerText(),/Exercício 1\/10/);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    const adminContext=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});
    await adminContext.addInitScript(session=>{localStorage.setItem('arca.admin.session.v1',JSON.stringify(session));},sessionFor(admin));
    await adminContext.route('https://*.supabase.co/**',async route=>{
      const path=new URL(route.request().url()).pathname;let data;
      if(path.endsWith('/arca_admin_access'))data=true;
      else if(path.endsWith('/arca_admin_reports'))data={items:[report],total:1,offset:0};
      else if(path.endsWith('/arca_admin_overview'))data={users:2,newUsers7:2,students7:0,lessons7:0,newReports:1,reviewingReports:0,resolvedReports:0,reportedQuestions:1,days:Array.from({length:14},(_,index)=>{const day=new Date();day.setUTCDate(day.getUTCDate()-13+index);return {day:day.toISOString().slice(0,10),lessons:0,students:0};})};
      else if(path.endsWith('/user'))data=sessionFor(admin).user;
      else throw new Error('Unexpected admin endpoint '+path);
      await route.fulfill({status:200,json:data});
    });
    const panel=await adminContext.newPage();panel.on('pageerror',error=>errors.push(error.message));await panel.goto(dashboard);await panel.getByRole('button',{name:'Relatos 1',exact:true}).click();await panel.getByRole('button',{name:report.question.prompt,exact:true}).click();
    await panel.getByRole('dialog').getByText('Quero conferir esta resposta.',{exact:true}).waitFor();await panel.getByRole('dialog').getByText('Uma coleção de livros',{exact:true}).last().waitFor();
    await adminContext.close();await context.close();console.log(`PASS ${width}px: new report UI, no email, bounded form, failure preserves input, same-key retry, server receipt, lesson answer retained, report visible in separate dashboard.`);
  }
  const guest=await browser.newContext({viewport:{width:320,height:640},reducedMotion:'reduce'});let submits=0;
  await guest.addInitScript(()=>{localStorage.setItem('arca.visitor','active');localStorage.setItem('arca.onboarding.v1','done');});
  await guest.route('https://*.supabase.co/**',async route=>{if(route.request().url().includes('submit_question_report'))submits++;await route.fulfill({status:503,json:{message:'offline'}});});
  const page=await guest.newPage();await page.goto(base+'/lesson/'+initialUnit.lessons[0].id);await page.getByRole('button',{name:'Reportar problema na pergunta',exact:true}).click();await page.getByText('Entre na sua conta para enviar relatos. Você pode continuar esta lição normalmente.',{exact:true}).waitFor();await page.getByRole('button',{name:'Voltar à lição',exact:true}).click();assert.equal(submits,0);await guest.close();assert.deepEqual(errors,[]);
}finally{await browser.close();}
