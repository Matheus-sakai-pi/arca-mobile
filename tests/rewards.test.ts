import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createMotionLedger, rankDirection, recentCompletion } from '../src/lib/motionEvents.ts';
import { achievementDefinitions, achievementKey, createAchievementStore, eligibleAchievements, parseAchievements, unlockAchievements } from '../src/lib/achievements.ts';
import { createProgress } from '../src/lib/learningProgress.ts';
import { learningUnits } from '../src/data/lessons.ts';

test('motion ledger treats first data as a baseline, animates real changes and never repeats on rerender/remount',()=>{
  const ledger=createMotionLedger();
  ledger.seed('xp',118);ledger.seed('xp',999);
  assert.equal(ledger.baseline('xp'),118);
  assert.deepEqual(ledger.number('home:xp',118),{from:118,to:118,event:0});
  const changed=ledger.number('home:xp',138);
  assert.equal(changed.from,118);assert.equal(changed.to,138);assert.ok(changed.event);
  assert.deepEqual(ledger.number('home:xp',138),{from:138,to:138,event:0});
  assert.equal(ledger.peek('home:xp'),138);
  assert.equal(ledger.number('learn:xp',138,false,ledger.baseline('xp')).from,118);
  assert.equal(createMotionLedger().number('home:xp',138).event,0);
});
test('profile/result entrance happens once per session and identity, not each entry',()=>{
  const ledger=createMotionLedger();
  assert.equal(ledger.number('profile:lessons',8,true).from,0);
  assert.equal(ledger.number('profile:lessons',8,true).event,0);
  assert.equal(ledger.number('profile:lessons',9,true).from,8);
  assert.equal(ledger.number('result:a:xp',25,true).from,0);
  assert.equal(ledger.number('result:a:xp',25,true).event,0);
  assert.equal(ledger.number('result:b:xp',25,true).from,0);
});
test('coin event claims are single-use and only newly completed lessons qualify',()=>{
  const ledger=createMotionLedger();
  assert.equal(recentCompletion(['a'],['a','b'],'b'),'b');
  assert.equal(recentCompletion(['a'],['a'],'a'),null);
  assert.equal(recentCompletion([],['a'],undefined),null);
  assert.equal(ledger.claim('coin:b','attempt'),true);
  assert.equal(ledger.claim('coin:b','attempt'),false);
  assert.equal(ledger.wasClaimed('coin:b','attempt'),true);
  assert.equal(ledger.claim('podium:1','session'),true);
  assert.equal(ledger.claim('podium:1','session'),false);
});
test('rank motion distinguishes upward, downward and unchanged positions without zero baselines',()=>{
  assert.equal(rankDirection(12,9),-1);assert.equal(rankDirection(9,12),1);assert.equal(rankDirection(9,9),0);
  const ledger=createMotionLedger();assert.equal(ledger.number('rank:a',12).event,0);
  assert.equal(ledger.number('rank:a',9).from,12);
});
const facts=()=>({progress:createProgress(),units:learningUnits,longestStreak:0});
test('nine achievement definitions reflect real progress, perfect result, units, streak and XP thresholds',()=>{
  assert.equal(achievementDefinitions.length,9);assert.deepEqual(eligibleAchievements(facts()),[]);
  const input=facts();
  input.progress={...input.progress,xp:1000,completedLessonIds:learningUnits.flatMap(unit=>unit.lessons.map(lesson=>lesson.id)),lastResult:{attemptId:'a',lessonId:learningUnits[0]!.lessons[0]!.id,correct:5,total:5,accuracy:100,xpEarned:25,completedAt:'2026-10-07T12:00:00Z'}};
  input.longestStreak=7;
  assert.deepEqual(eligibleAchievements(input),achievementDefinitions.map(item=>item.id));
  input.progress.completedLessonIds=learningUnits[0]!.lessons.slice(0,9).map(lesson=>lesson.id);
  assert.ok(!eligibleAchievements(input).includes('scholar'));
  input.progress.completedLessonIds.push(learningUnits[0]!.lessons[9]!.id);
  assert.ok(eligibleAchievements(input).includes('scholar'));
});
test('partial units and non-perfect/unknown results cannot unlock completion achievements',()=>{
  const input=facts();input.progress.completedLessonIds=[learningUnits[0]!.lessons[0]!.id];
  input.progress.xp=499;input.longestStreak=2;
  assert.deepEqual(eligibleAchievements(input),['first_step']);
  input.progress.lastResult={attemptId:'a',lessonId:'unknown',correct:5,total:5,accuracy:100,xpEarned:25,completedAt:'2026-10-07'};
  assert.deepEqual(eligibleAchievements(input),['first_step']);
});
test('achievement queue is deduplicated, ordered and earned achievements are never revoked',()=>{
  const first=unlockAchievements(parseAchievements(null),['first_step','perfect_lesson'],true);
  assert.deepEqual(first.pending,['first_step','perfect_lesson']);
  assert.deepEqual(unlockAchievements(first,['first_step','perfect_lesson'],true),first);
  assert.deepEqual(unlockAchievements(first,[],true),first);
  assert.deepEqual(unlockAchievements(parseAchievements(null),['first_step'],false).pending,[]);
});
test('local achievement storage is isolated by account/guest and resumes pending queue after reopening',async()=>{
  const values=new Map<string,string>();
  const storage={getItem:async(key:string)=>values.get(key)??null,setItem:async(key:string,value:string)=>{values.set(key,value);}};
  const input=facts();input.progress.completedLessonIds=[learningUnits[0]!.lessons[0]!.id];
  const account=createAchievementStore(storage,'a');await account.load();await account.evaluate(input);
  assert.deepEqual((await createAchievementStore(storage,'a').load()).pending,['first_step']);
  assert.deepEqual((await createAchievementStore(storage,'b').load()).unlocked,[]);
  assert.deepEqual((await createAchievementStore(storage,'guest').load()).unlocked,[]);
  await account.acknowledge('first_step');assert.deepEqual((await createAchievementStore(storage,'a').load()).pending,[]);
  assert.notEqual(achievementKey('a'),achievementKey('guest'));
});
test('storage failure cannot grant an achievement or consume its celebration; retry is safe',async()=>{
  let raw:string|null=null,fail=false;
  const storage={getItem:async()=>raw,setItem:async(_key:string,value:string)=>{if(fail) throw new Error('disk');raw=value;}};
  const store=createAchievementStore(storage,'a');await store.load();
  const input=facts();input.progress.completedLessonIds=[learningUnits[0]!.lessons[0]!.id];
  fail=true;await assert.rejects(store.evaluate(input),/disk/);assert.deepEqual((await store.load()).unlocked,[]);
  fail=false;await store.evaluate(input);
  fail=true;await assert.rejects(store.acknowledge('first_step'),/disk/);assert.deepEqual((await store.load()).pending,['first_step']);
  fail=false;await store.acknowledge('first_step');assert.deepEqual((await store.load()).pending,[]);
});
test('malformed achievement storage is rejected and preserved, not silently reset',async()=>{
  for(const raw of ['broken',JSON.stringify({version:1,unlocked:['unknown'],pending:[]}),JSON.stringify({version:1,unlocked:[],pending:['first_step']})]) assert.throws(()=>parseAchievements(raw));
  let writes=0;
  const store=createAchievementStore({getItem:async()=>'broken',setItem:async()=>{writes++;}},'a');
  await assert.rejects(store.load());assert.equal(writes,0);
});
test('reward layer does not write backend or progress and all reusable motions respect reduced motion',async()=>{
  const source=await readFile(new URL('../src/providers/RewardMotionProvider.tsx',import.meta.url),'utf8');
  assert.doesNotMatch(source,/supabase|finishLesson\(|completeLesson\(/);
  assert.match(source,/pending > 0 \|\| offline/);
  for(const file of ['AnimatedNumber','AnimatedProgressBar','AnimatedCompletionCoin','RewardPulse','PodiumEntrance','AnimatedRankChange']) {
    const text=await readFile(new URL(`../src/components/animation/${file}.tsx`,import.meta.url),'utf8');
    assert.match(text,/useMotionPreference/);assert.match(text,/ReduceMotion.System/);assert.doesNotMatch(text,/setInterval|setTimeout/);
  }
  const lesson=await readFile(new URL('../src/components/learning/LessonPlayer.tsx',import.meta.url),'utf8');
  assert.match(lesson,/resetScrollKey=\{exerciseKey\}/);assert.doesNotMatch(lesson,/<Screen key=\{question.id\}/);
  assert.match(lesson,/<QuestionRenderer key=\{exerciseKey\}/);
  const preference=await readFile(new URL('../src/hooks/useMotionPreference.ts',import.meta.url),'utf8');
  assert.match(preference,/useReducedMotion/);assert.match(preference,/reduceMotion \|\| system/);
});
