import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialUnit } from '../src/data/lessons.ts';
import { createStudyStore, dailyExercises, dueReviews, lessonFingerprint, localDay, restoredDraft, reviewSchedule, studyKey, subjectPerformance } from '../src/lib/studyStore.ts';
import { createAttempt, reduceAttempt, scoreAnswers, type LessonAttempt } from '../src/lib/lessonEngine.ts';
import { createAccountStorage } from '../src/lib/accountStorageGuard.ts';
import { defaultPreferences, parsePreferences, preferencesKey } from '../src/lib/preferencesStore.ts';
import { clearDiagnostics, diagnosticSnapshot, recordDiagnostic } from '../src/lib/diagnostics.ts';
import { supportRequestUrl } from '../src/lib/supportRequest.ts';
import { safeSystemPath } from '../src/lib/systemPath.ts';
import { answersFor, wrongAnswer } from './learningFixtures.ts';
import type { LessonResult } from '../src/types/learning.ts';

const lesson=initialUnit.lessons[0]!;
function storage() {
  const data=new Map<string,string>();
  return {data,getItem:async(key:string)=>data.get(key) ?? null,setItem:async(key:string,value:string)=>{data.set(key,value);},getAllKeys:async()=>[...data.keys()],multiRemove:async(keys:string[])=>{keys.forEach(key=>data.delete(key));}};
}
function result(attemptId='one',completedAt='2026-10-14T12:00:00.000Z',correct=8):LessonResult {
  return {attemptId,lessonId:lesson.id,correct,total:10,accuracy:correct*10,xpEarned:26,completedAt};
}
test('resume preserves first wrong answer, feedback, queue and identity across reload',async()=>{
  const memory=storage(); const store=createStudyStore(memory,'A'); await store.load();
  let state=reduceAttempt(lesson,createAttempt(),{type:'answer',answer:wrongAnswer(lesson.questions[0]!)});
  state=reduceAttempt(lesson,state,{type:'verify'});
  await store.saveDraft(lesson,'original-attempt',state);
  const reloaded=createStudyStore(memory,'A'); await reloaded.load();
  const draft=restoredDraft(lesson,reloaded.getState().drafts[lesson.id])!;
  assert.equal(draft.attemptId,'original-attempt'); assert.equal(draft.state.phase,'feedback');
  state=reduceAttempt(lesson,draft.state,{type:'continue'});
  assert.equal(state.remaining!.at(-1),0);
  while(state.phase !== 'finished') {
    const question=lesson.questions[state.index]!;
    state=reduceAttempt(lesson,state,{type:'answer',answer:question.correctAnswer});
    state=reduceAttempt(lesson,state,{type:'verify'});
    state=reduceAttempt(lesson,state,{type:'continue'});
  }
  assert.equal(scoreAnswers(lesson,state.answers).correct,9);
});
test('changed curriculum and malformed states never resume a stale attempt',()=>{
  const draft={attemptId:'original',fingerprint:lessonFingerprint(lesson),state:createAttempt(),updatedAt:new Date().toISOString()};
  assert.ok(restoredDraft(lesson,draft));
  assert.equal(restoredDraft({...lesson,questions:lesson.questions.slice(0,5)},draft),null);
  for(const value of [{...draft.state,index:999},{...draft.state,remaining:[0]},{...draft.state,answers:{unknown:'x'}},{...draft.state,phase:'feedback',answer:null}]) {
    assert.equal(restoredDraft(lesson,{...draft,state:value as LessonAttempt}),null);
  }
});
test('completion removes its draft and late writes cannot recreate it; duplicates do not increase daily goal',async()=>{
  const store=createStudyStore(storage(),'guest'); await store.load();
  await store.saveDraft(lesson,'one',createAttempt());
  await store.complete(result(),lesson,answersFor(lesson,8));
  await store.saveDraft(lesson,'one',createAttempt()); await store.complete(result());
  assert.equal(store.getState().drafts[lesson.id],undefined);
  assert.equal(store.getState().history.length,1);
  assert.equal(store.getState().history[0]!.mistakes.length,2);
  assert.equal(dailyExercises(store.getState().history,store.getState().history[0]!.day),10);
});
test('history is isolated by owner, merges server receipts without duplication, and is bounded',async()=>{
  const memory=storage(); const a=createStudyStore(memory,'A'),b=createStudyStore(memory,'B');
  await a.load();await b.load();await a.complete(result());
  assert.equal(b.getState().history.length,0);
  await a.mergeHistory([result('one',undefined,9)]);
  assert.equal(a.getState().history.length,1);assert.equal(a.getState().history[0]!.result.correct,9);
  await a.mergeHistory(Array.from({length:600},(_,i)=>result(`attempt-${i}`,new Date(1700000000000+i*1000).toISOString())));
  assert.equal(a.getState().history.length,500);
});
test('spaced review intervals expand with good accuracy, reset after mistakes, and never unlock lessons',async()=>{
  const store=createStudyStore(storage(),'A');await store.load();
  await store.complete(result('first','2026-10-01T12:00:00Z',10));
  assert.equal(reviewSchedule(store.getState().history,lesson.id)!.intervalDays,1);
  await store.complete(result('second','2026-10-02T12:00:00Z',10));
  assert.equal(reviewSchedule(store.getState().history,lesson.id)!.intervalDays,3);
  await store.complete(result('third','2026-10-05T12:00:00Z',5));
  assert.equal(reviewSchedule(store.getState().history,lesson.id)!.intervalDays,1);
  assert.equal(dueReviews(store.getState().history,initialUnit,[],Date.parse('2026-10-10')).length,0);
  assert.equal(dueReviews(store.getState().history,initialUnit,[lesson.id],Date.parse('2026-10-10')).length,1);
});
test('accuracy by subject is weighted by question count, including old five-question results',async()=>{
  const store=createStudyStore(storage(),'A');await store.load();
  await store.complete(result('ten',undefined,8));
  await store.complete({...result('five'),correct:5,total:5,accuracy:100});
  assert.deepEqual(subjectPerformance(store.getState().history,initialUnit),[{unitId:lesson.unitId,correct:13,total:15,attempts:2,accuracy:87}]);
});
test('early repeated reviews do not advance to long intervals',async()=>{
  const store=createStudyStore(storage(),'A');await store.load();
  for(let i=0;i<5;i++)await store.complete(result('same-day-'+i,new Date(Date.parse('2026-10-14T12:00:00Z')+i*60000).toISOString(),10));
  assert.equal(reviewSchedule(store.getState().history,lesson.id)!.intervalDays,1);
});
test('local days and midnight goals are calculated without UTC date slicing',()=>{
  assert.equal(localDay(new Date(2026,9,14,0,1)),'2026-10-14');
  assert.equal(dailyExercises([{result:result(),day:'2026-10-13',mistakes:[]}],'2026-10-14'),0);
});
test('failed draft writes preserve the last durable draft, and malformed storage is not overwritten',async()=>{
  const memory=storage();const store=createStudyStore(memory,'A');await store.load();await store.saveDraft(lesson,'one',createAttempt());
  memory.setItem=async()=>{throw new Error('disk');};
  const broken=createStudyStore(memory,'A');await broken.load();await assert.rejects(broken.saveDraft(lesson,'two',createAttempt()));
  assert.equal(broken.getState().drafts[lesson.id]!.attemptId,'one');
  memory.data.set(studyKey('B'),'broken');const b=createStudyStore(memory,'B');await assert.rejects(b.load());assert.equal(memory.data.get(studyKey('B')),'broken');
});
test('deletion includes drafts, history and preferences of only the deleted account',async()=>{
  const memory=storage();const guarded=createAccountStorage(memory);
  for(const scope of ['A','B','guest']) {await guarded.setItem(studyKey(scope),'study');await guarded.setItem(preferencesKey(scope),'preferences');}
  await guarded.clearUser('A');
  assert.equal(memory.data.has(studyKey('A')),false);assert.equal(memory.data.has(preferencesKey('A')),false);
  assert.equal(memory.data.has(studyKey('B')),true);assert.equal(memory.data.has(studyKey('guest')),true);
  await assert.rejects(guarded.setItem(studyKey('A'),'late'));
});
test('preferences validate values and remain backward-compatible with sound-only migration',()=>{
  assert.deepEqual(parsePreferences(null),defaultPreferences);
  assert.deepEqual(parsePreferences(JSON.stringify({...defaultPreferences,dailyGoal:30,hapticsEnabled:false})),{...defaultPreferences,dailyGoal:30,hapticsEnabled:false});
  assert.throws(()=>parsePreferences(JSON.stringify({...defaultPreferences,dailyGoal:-1})));
  assert.throws(()=>parsePreferences('broken'));
  assert.notEqual(preferencesKey('A'),preferencesKey('B'));
});
test('diagnostics are bounded, opt-in for email, and contain no raw errors or user identity',()=>{
  clearDiagnostics();for(let i=0;i<50;i++)recordDiagnostic('curriculum_loaded',i);
  assert.equal(diagnosticSnapshot().length,30);
  const plain=decodeURIComponent(supportRequestUrl('0.1.0'));
  assert.doesNotMatch(plain,/curriculum_loaded/);
  const withLogs=decodeURIComponent(supportRequestUrl('0.1.0',undefined,diagnosticSnapshot()));
  assert.match(withLogs,/curriculum_loaded/);assert.doesNotMatch(withLogs,/access_token|Bearer|user_id/);
  const question=decodeURIComponent(supportRequestUrl('0.1.0',{lessonId:'lesson',questionId:'question'}));
  assert.match(question,/Lição: lesson/);assert.match(question,/Pergunta: question/);
  clearDiagnostics();
});
test('native deep links reject malformed encodings and excessive lengths without breaking auth or Expo Go',()=>{
  for(const path of ['arca://auth/callback#access_token=abc&refresh_token=def','exp://192.168.1.3:8084/--/home','/learn?name=Jo%C3%A3o'])assert.equal(safeSystemPath(path),path);
  for(const path of ['arca://home?x=%C2%FF','arca://home?x=%','/'.repeat(5000)])assert.equal(safeSystemPath(path),'/');
});
