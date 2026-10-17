import assert from 'node:assert/strict';
import { test } from 'node:test';
import { combineUnits, fiveQuestionLearningUnits as learningUnits } from '../src/data/lessons.ts';
import { accountKey, createAccountLearningStore, guestSource, parseAccountCache } from '../src/lib/accountLearningStore.ts';
import { BackendRejectedError } from '../src/lib/backendErrors.ts';
import { decodeSnapshot, decodeUnit } from '../src/lib/backendDecoders.ts';
import { createProgress, completeLesson, PROGRESS_KEY } from '../src/lib/learningProgress.ts';
import { createAttempt, reduceAttempt, scoreAnswers } from '../src/lib/lessonEngine.ts';
import type { AccountSnapshot, LearningRepository, PendingAttempt } from '../src/types/backend.ts';
import type { LessonAnswers, Unit } from '../src/types/learning.ts';
import { answersFor } from './learningFixtures.ts';
import { accountAccessToken } from '../src/lib/accountToken.ts';

const initialUnit = combineUnits(learningUnits);
const first=initialUnit.lessons[0]!,second=initialUnit.lessons[1]!;
const date='2026-10-06T12:00:00.000Z';
test('an old account request never borrows the next signed-in account token',async()=>{
  let session:{user:{id:string};access_token:string}|null={user:{id:'a'},access_token:'token-a'};
  const token=accountAccessToken('a',async()=>({data:{session},error:null}));
  const captured=await token();
  session={user:{id:'b'},access_token:'token-b'};
  assert.equal(captured,'token-a');await assert.rejects(token(),/account_changed/);
  session=null;await assert.rejects(token(),/account_changed/);
});
function fixtures(id='a') {
  const values=new Map<string,string>();
  let diskFails=false,online=true,loseReceipt=false,rejected=false;
  let snapshot:AccountSnapshot={progress:createProgress(),guestImported:false,profile:{id,display_name:'Aprendiz',username:'aprendiz',avatar_key:'learner',avatar_url:null,xp_total:0,current_streak:0,longest_streak:0,last_activity_date:null,created_at:date,updated_at:date}};
  const receipts=new Map<string,Awaited<ReturnType<LearningRepository['complete']>>>();
  const calls:PendingAttempt[]=[];
  const storage={getItem:async(key:string)=>values.get(key)??null,setItem:async(key:string,value:string)=>{if(diskFails)throw new Error('disk');values.set(key,value);}};
  const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;
  const assertOnline=()=>{if(!online)throw new Error('network');};
  const repo:LearningRepository={
    loadUnit:async()=>{assertOnline();return initialUnit;},
    loadSnapshot:async()=>{assertOnline();return clone(snapshot);},
    start:async()=>assertOnline(),
    complete:async attempt=>{
      assertOnline();calls.push(clone(attempt));
      if(rejected)throw new BackendRejectedError('answer_invalid');
      let receipt=receipts.get(attempt.id);
      if(!receipt) {
        const lesson=initialUnit.lessons.find(l=>l.id===attempt.lessonId)!;
        snapshot={...snapshot,progress:completeLesson(snapshot.progress,lesson,attempt.answers,attempt.id,date)};
        snapshot.profile={...snapshot.profile,xp_total:snapshot.progress.xp};
        receipt={snapshot:clone(snapshot),result:snapshot.progress.lastResult!};receipts.set(attempt.id,receipt);
      }
      if(loseReceipt){loseReceipt=false;online=false;throw new Error('response lost');}
      return clone({...receipt,snapshot});
    },
    importGuest:async(_source,progress)=>{assertOnline();if(!snapshot.guestImported)snapshot={...snapshot,progress:{...progress,lastResult:null},profile:{...snapshot.profile,xp_total:progress.xp},guestImported:true};return clone(snapshot);},
    updateProfile:async identity=>{assertOnline();snapshot={...snapshot,profile:{...snapshot.profile,...identity}};return clone(snapshot.profile);},
    updateAvatar:async key=>{assertOnline();snapshot={...snapshot,profile:{...snapshot.profile,avatar_key:key}};return {avatar_key:key,updated_at:date};},
  };
  return {values,storage,repo,calls,get snapshot(){return snapshot;},set online(value:boolean){online=value;},set diskFails(value:boolean){diskFails=value;},set loseReceipt(value:boolean){loseReceipt=value;},set rejected(value:boolean){rejected=value;}};
}
test('offline outbox survives reopening and replays sequential lessons exactly once',async()=>{
  const f=fixtures();const store=createAccountLearningStore(f.storage,'a',f.repo);await store.load();f.online=false;
  const one=await store.complete(first,answersFor(first),'one');assert.equal(one.state.progress.xp,25);assert.equal(one.state.pending,1);
  await store.complete(second,answersFor(second),'two');
  const reopened=createAccountLearningStore(f.storage,'a',f.repo);const local=await reopened.load();
  assert.equal(local.progress.xp,50);assert.equal(local.pending,2);assert.equal(local.offline,true);assert.equal(f.snapshot.progress.xp,0);
  f.online=true;const synced=await reopened.sync();
  assert.equal(synced.pending,0);assert.equal(synced.progress.xp,50);assert.equal(synced.profile.xp_total,50);
  await reopened.sync();assert.equal(f.calls.length,2);
  assert.equal((await createAccountLearningStore(f.storage,'a',f.repo).load()).progress.xp,50);
});
test('lost server receipt retains attempt ID; retry does not duplicate confirmed XP',async()=>{
  const f=fixtures();const store=createAccountLearningStore(f.storage,'a',f.repo);await store.load();f.loseReceipt=true;
  const done=await store.complete(first,answersFor(first),'lost');assert.equal(done.state.pending,1);assert.equal(f.snapshot.progress.xp,25);
  f.online=true;const reopened=createAccountLearningStore(f.storage,'a',f.repo);const saved=await reopened.load();
  assert.equal(saved.progress.xp,25);assert.equal(saved.pending,0);assert.deepEqual(f.calls.map(a=>a.id),['lost','lost']);
});
test('disk failure cannot grant XP, remove an outbox item or overwrite guest progress',async()=>{
  const f=fixtures();f.values.set(PROGRESS_KEY,'original guest');const store=createAccountLearningStore(f.storage,'a',f.repo);await store.load();
  f.diskFails=true;await assert.rejects(store.complete(first,answersFor(first),'disk'));assert.equal(store.getState().progress.xp,0);assert.equal(f.calls.length,0);
  f.diskFails=false;f.online=false;await store.complete(first,answersFor(first),'disk');
  f.online=true;f.diskFails=true;await assert.rejects(store.sync());assert.equal(store.getState().pending,1);
  f.diskFails=false;assert.equal((await store.sync()).progress.xp,25);assert.equal(f.values.get(PROGRESS_KEY),'original guest');
});
test('accounts have separate caches and snapshots; a new offline account never inherits another account',async()=>{
  const f=fixtures();const a=createAccountLearningStore(f.storage,'a',f.repo);await a.load();await a.complete(first,answersFor(first),'a');
  const other=fixtures('b');other.online=false;const b=createAccountLearningStore(f.storage,'b',other.repo);const state=await b.load();
  assert.equal(state.progress.xp,0);assert.equal(state.profile.id,'b');assert.notEqual(accountKey('a'),accountKey('b'));
  assert.throws(()=>parseAccountCache(f.values.get(accountKey('a'))!,'b'));
});
test('permanent server rejection is quarantined, never retried forever or silently erased',async()=>{
  const f=fixtures();const store=createAccountLearningStore(f.storage,'a',f.repo);await store.load();f.online=false;
  await store.complete(first,answersFor(first),'reject');f.online=true;f.rejected=true;
  const state=await store.sync();assert.equal(state.pending,0);assert.equal(state.rejected,1);assert.equal(state.progress.xp,0);
  await store.sync();assert.equal(f.calls.length,1);await assert.rejects(store.complete(first,answersFor(first),'reject'));
  assert.equal(parseAccountCache(f.values.get(accountKey('a'))!,'a').rejected[0]?.id,'reject');
});
test('corrupt account cache is preserved until authoritative recovery and backed up before replacement',async()=>{
  const f=fixtures();f.values.set(accountKey('a'),'{bad');f.online=false;
  await assert.rejects(createAccountLearningStore(f.storage,'a',f.repo).load());
  assert.equal(f.values.get(accountKey('a')),'{bad');f.online=true;
  assert.equal((await createAccountLearningStore(f.storage,'a',f.repo).load()).progress.xp,0);
  assert.equal([...f.values.entries()].find(([key])=>key.startsWith(accountKey('a')+'.backup'))?.[1],'{bad');
});
test('guest migration is explicit, retryable, idempotent and never deletes the local snapshot',async()=>{
  const f=fixtures();const guest=completeLesson(createProgress(),first,answersFor(first),'guest',date);
  const raw=JSON.stringify(guest);f.values.set(PROGRESS_KEY,raw);
  const store=createAccountLearningStore(f.storage,'a',f.repo);await store.load();assert.equal(store.getState().progress.xp,0);
  const source=await guestSource(f.storage);assert.equal(await guestSource(f.storage),source);
  f.online=false;await assert.rejects(store.importGuest(source,guest));assert.equal(f.values.get(PROGRESS_KEY),raw);
  f.online=true;assert.equal((await store.importGuest(source,guest)).progress.xp,25);
  assert.equal((await store.importGuest(source,guest)).progress.xp,25);assert.equal(f.values.get(PROGRESS_KEY),raw);
});
test('identity changes persist without changing XP/progress',async()=>{
  const f=fixtures();const store=createAccountLearningStore(f.storage,'a',f.repo);await store.load();await store.complete(first,answersFor(first),'done');
  const changed=await store.updateProfile({display_name:'Novo nome',username:'novo_nome',avatar_key:'learner'});
  assert.equal(changed.profile.display_name,'Novo nome');assert.equal(changed.progress.xp,25);assert.equal(parseAccountCache(f.values.get(accountKey('a'))!,'a').snapshot.profile.username,'novo_nome');
});

test('avatar updates persist independently without reloading content or progress, including offline restart',async()=>{
  const f=fixtures();const store=createAccountLearningStore(f.storage,'a',f.repo);await store.load();
  await store.complete(first,answersFor(first),'avatar-progress');
  f.repo.loadSnapshot=async()=>{throw new Error('avatar must not fetch a full snapshot');};
  f.repo.loadUnit=async()=>{throw new Error('avatar must not fetch content');};
  const changed=await store.updateAvatar('avatar-03');
  assert.equal(changed.profile.avatar_key,'avatar-03');assert.equal(changed.progress.xp,25);
  assert.deepEqual(changed.progress.completedLessonIds,[first.id]);
  f.online=false;
  const restored=await createAccountLearningStore(f.storage,'a',f.repo).load();
  assert.equal(restored.profile.avatar_key,'avatar-03');assert.equal(restored.progress.xp,25);
  await assert.rejects(store.updateAvatar('avatar-04'));
  assert.equal(store.getState().profile.avatar_key,'avatar-03');
});
test('backend decoders round-trip existing varied content and reject malformed/cross-account data',()=>{
  const lessons=initialUnit.lessons.map(l=>({...l,unit_id:l.unitId}));
  const questions=initialUnit.lessons.flatMap(l=>l.questions.map(q=>{const {id,type,prompt,explanation,...content}=q;return{id,type,prompt,explanation,content,lesson_id:l.id};}));
  assert.deepEqual(combineUnits(learningUnits.map(unit=>decodeUnit(unit,lessons.filter(lesson=>lesson.unit_id === unit.id),questions))),initialUnit);
  assert.throws(()=>decodeUnit(learningUnits[0],lessons.filter(lesson=>lesson.unit_id === learningUnits[0]!.id),questions.map(q=>({...q,type:'unknown'}))));
  assert.throws(()=>decodeSnapshot({unitId:initialUnit.id,xp:0,completedLessonIds:[],lastResult:null,guestImported:false,profile:fixtures('b').snapshot.profile},'a',initialUnit));
});
test('content cards progress independently without feedback sound or reward inflation',()=>{
  const card={id:'read',type:'content_card' as const,prompt:'Leia',body:'A Bíblia reúne livros.',options:[],correctAnswer:'seen' as const,explanation:''};
  const unit:Unit={...initialUnit,lessons:[{...first,questions:[card,...first.questions]}]};
  const lesson=unit.lessons[0]!;let attempt=createAttempt();
  assert.equal(reduceAttempt(lesson,attempt,{type:'verify'}),attempt);
  attempt=reduceAttempt(lesson,attempt,{type:'read'});assert.equal(attempt.index,1);assert.equal(attempt.phase,'answering');
  const answers:LessonAnswers={...answersFor(first),read:'seen'};
  assert.deepEqual(scoreAnswers(lesson,answers),{correct:5,total:5,accuracy:100});
  assert.equal(completeLesson(createProgress(unit),lesson,answers,'read',date,unit).xp,25);
});
