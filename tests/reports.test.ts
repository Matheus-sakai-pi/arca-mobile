import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {test} from 'node:test';
import {PGlite} from '@electric-sql/pglite';
import {decodeReportReceipt,reportError} from '../src/lib/reports.ts';

const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
test('report receipts are owner-bound and dashboard is not a mobile route',async()=>{
  assert.deepEqual(decodeReportReceipt({id:id(10),reporterId:id(1),received:true,duplicate:false},id(1)),{id:id(10),duplicate:false});
  for(const value of [null,{}, {id:id(10),reporterId:id(2),received:true,duplicate:false}])assert.throws(()=>decodeReportReceipt(value,id(1)));
  assert.match(reportError({code:'PGRST202',message:'missing'}),/ativado/);
  assert.match(reportError({message:'report_limit'}),/limite/);
  assert.match(reportError({message:'report_question_missing'}),/atualizada/);
  await assert.rejects(access(new URL('../src/app/admin.tsx',import.meta.url)));
  const player=await readFile(new URL('../src/components/learning/LessonPlayer.tsx',import.meta.url),'utf8');
  assert.match(player,/<QuestionReport lessonId=\{lesson.id\} questionId=\{question.id\}/);
  assert.doesNotMatch(player,/reportQuestion|Linking|mailto|Reportar pergunta/);
  const service=await readFile(new URL('../src/services/reports.ts',import.meta.url),'utf8');
  assert.match(service,/scopedSupabase\(requireSupabase\(\), owner\)/);
  assert.doesNotMatch(service,/arca_admin_|mailto|Linking/);
});

test('PostgreSQL reports: protected administration, immutable snapshots, limits, filters and deletion',async t=>{
  const db=await PGlite.create();t.after(()=>db.close());
  await db.exec(`create role anon nologin;create role authenticated nologin;
    create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb,email text,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated;`);
  for(const file of ['202610050001_auth_profiles.sql','202610060001_learning_schema.sql','202610060002_learning_functions.sql','202610150003_reports_admin.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  for(let n=1;n<=3;n++)await db.query('insert into auth.users values($1,$2::jsonb,$3,now())',[id(n),JSON.stringify({display_name:'Pessoa '+n,role:'admin'}),n===1?'matheussakai23032001@gmail.com':`person${n}@example.test`]);
  await db.exec(`insert into courses(id,title,published) values('course','Curso',true);
    insert into units(id,course_id,title,published,order_index) values('unit','course','Unidade',true,0);
    insert into lessons(id,unit_id,title,published,order_index) values('lesson','unit','Lição publicada',true,0),('draft','unit','Rascunho',false,1);
    insert into questions(id,lesson_id,type,prompt,content,explanation,order_index)
      select 'q'||n,'lesson','multiple_choice','Pergunta '||n,jsonb_build_object('options',jsonb_build_array(jsonb_build_object('id','a','label','Sim'),jsonb_build_object('id','b','label','Não')),'correctAnswer','a'),'Explicação original',n from generate_series(1,13)n;
    insert into questions(id,lesson_id,type,prompt,content,explanation,order_index) values('hidden','draft','multiple_choice','Privada','{}','Oculta',0);`);
  const asUser=<T>(who:number|null,fn:(tx:Parameters<Parameters<typeof db.transaction>[0]>[0])=>Promise<T>)=>db.transaction(async tx=>{await tx.exec('set local role '+(who?'authenticated':'anon'));await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[who?id(who):'']);return fn(tx);});
  const rpc=(who:number|null,name:string,args:unknown[]=[])=>asUser(who,async tx=>(await tx.query<{value:unknown}>(`select public.${name}(${args.map((_,index)=>'$'+(index+1)).join(',')}) as value`,args)).rows[0]!.value);
  const submit=(who:number|null,q='q1',key='request-key-1',reason='answer',comment='Texto do relato',lesson='lesson')=>rpc(who,'submit_question_report',[lesson,q,reason,comment,'0.3.0','android',key]) as Promise<{id:string;duplicate:boolean;reporterId:string}>;
  await t.test('no implicit admin, no anonymous submission, no direct table access or self-promotion',async()=>{
    assert.equal(await rpc(1,'arca_admin_access'),false);
    await assert.rejects(rpc(1,'arca_admin_overview'),/admin_required/);
    await assert.rejects(submit(null),/permission denied/);
    for(const table of ['question_reports','arca_admins'])for(const role of [1,2,null])await assert.rejects(asUser(role,tx=>tx.query(`select * from public.${table}`)),/permission denied/);
    await assert.rejects(asUser(1,tx=>tx.query('insert into arca_admins(user_id) values($1)',[id(1)])),/permission denied/);
    await assert.rejects(rpc(1,'arca_is_admin'),/permission denied/);
    await db.exec(await readFile(new URL('../supabase/admin-access.sql',import.meta.url),'utf8'));
    assert.equal(await rpc(1,'arca_admin_access'),true);assert.equal(await rpc(2,'arca_admin_access'),false);
  });
  let first:string;
  await t.test('submission snapshots server content, retries and repeated question reports do not duplicate',async()=>{
    const receipt=await submit(2);first=receipt.id;
    assert.equal(receipt.reporterId,id(2));assert.equal(receipt.duplicate,false);
    assert.equal((await submit(2)).id,first);assert.equal((await submit(2)).duplicate,true);
    assert.equal((await submit(2,'q1','another-key')).id,first);
    await assert.rejects(submit(2,'q2','request-key-1'),/report_request_conflict/);
    await assert.rejects(submit(2,'q2','valid-key-2','bad'),/report_invalid/);
    await assert.rejects(submit(2,'q2','valid-key-2','answer','x'.repeat(1001)),/report_invalid/);
    await assert.rejects(submit(2,'hidden','valid-key-2','answer','','draft'),/report_question_missing/);
    await assert.rejects(submit(2,'q2','valid-key-2','answer','','wrong-lesson'),/report_question_missing/);
    await db.exec("update questions set prompt='Pergunta corrigida',explanation='Nova explicação' where id='q1'");
    const saved=(await db.query<{question_snapshot:{prompt:string;explanation:string}}>('select question_snapshot from question_reports where id=$1',[first])).rows[0]!;
    assert.equal(saved.question_snapshot.prompt,'Pergunta 1');assert.equal(saved.question_snapshot.explanation,'Explicação original');
    await submit(3,'q1','third-user-key');
  });
  await t.test('only admin lists and changes status; reading does not resolve; concurrency is checked',async()=>{
    for(const who of [null,2,3])for(const name of ['arca_admin_overview','arca_admin_reports'])await assert.rejects(rpc(who,name),/permission denied|admin_required/);
    const page=await rpc(1,'arca_admin_reports',['new','',0]) as {total:number;items:{id:string;status:string;updatedAt:string;questionReports:number;question:{prompt:string}}[]};
    assert.equal(page.total,2);assert.equal(page.items[0]!.questionReports,2);
    assert.ok(page.items.every(item=>item.status==='new'));
    assert.ok(page.items.every(item=>!('reporterId' in item)&&!('email' in item)));
    assert.equal((await db.query<{n:number}>("select count(*)::int n from question_reports where status='new'")).rows[0]!.n,2);
    const item=page.items.find(item=>item.id===first)!;
    await assert.rejects(rpc(2,'arca_admin_report_status',[item.id,'resolved',item.updatedAt]),/admin_required/);
    await rpc(1,'arca_admin_report_status',[item.id,'reviewing',item.updatedAt]);
    await assert.rejects(rpc(1,'arca_admin_report_status',[item.id,'resolved',item.updatedAt]),/report_conflict/);
    const filtered=await rpc(1,'arca_admin_reports',['reviewing','Pergunta 1',0]) as {total:number;items:unknown[]};assert.equal(filtered.total,1);
    assert.equal((await rpc(1,'arca_admin_reports',['all','%',0]) as {total:number}).total,0,'Search treats wildcard characters literally');
    await assert.rejects(rpc(1,'arca_admin_reports',['hacked','',0]),/report_filter_invalid/);
    await assert.rejects(rpc(1,'arca_admin_reports',['all','',-1]),/report_filter_invalid/);
  });
  await t.test('overview counts real study receipts, not manually granted XP or invented app openings',async()=>{
    await db.query("update profiles set xp_total=900 where id=$1",[id(2)]);
    await db.query("insert into lesson_attempts(user_id,lesson_id,attempt_key,answers,result,created_at) values($1,'lesson','recent-1','{}','{}',now()),($1,'lesson','recent-2','{}','{}',now()-interval '1 day'),($2,'lesson','old','{}','{}',now()-interval '8 days')",[id(2),id(3)]);
    const overview=await rpc(1,'arca_admin_overview') as {users:number;students7:number;lessons7:number;newReports:number;reviewingReports:number;days:unknown[]};
    assert.equal(overview.users,3);assert.equal(overview.students7,1);assert.equal(overview.lessons7,2);assert.equal(overview.newReports,1);assert.equal(overview.reviewingReports,1);assert.equal(overview.days.length,14);
    assert.ok(!('appOpens' in overview)&&!('paidPlans' in overview));
  });
  await t.test('daily quota, pagination and deleting a user preserve other reports and curriculum',async()=>{
    for(let n=2;n<=10;n++)await submit(2,'q'+n,'quota-key-'+n);
    await assert.rejects(submit(2,'q11','quota-key-11'),/report_limit/);
    await db.exec(`insert into question_reports(reporter_id,request_key,lesson_id,question_id,lesson_title,question_snapshot,reason,comment,app_version,platform)
      select '${id(3)}','page-key-'||n,'lesson','q1','Lição','{}','text','','0.3.0','web' from generate_series(1,52)n`);
    const firstPage=await rpc(1,'arca_admin_reports',['all','',0]) as {total:number;items:unknown[]};assert.equal(firstPage.items.length,50);assert.equal(firstPage.total,63);
    const next=await rpc(1,'arca_admin_reports',['all','',50]) as {items:unknown[]};assert.equal(next.items.length,13);
    await db.query('delete from auth.users where id=$1',[id(2)]);
    assert.equal((await db.query<{n:number}>('select count(*)::int n from question_reports where reporter_id=$1',[id(2)])).rows[0]!.n,0);
    assert.equal((await db.query<{n:number}>('select count(*)::int n from question_reports')).rows[0]!.n,53);
    assert.equal((await db.query<{n:number}>('select count(*)::int n from questions')).rows[0]!.n,14);
    await db.query('delete from auth.users where id=$1',[id(1)]);assert.equal((await db.query('select * from arca_admins')).rows.length,0);
  });
});
