import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { initialUnit } from '../src/data/lessons.ts';
import { canVerify, evaluateQuestion, isValidAnswer, isValidQuestion } from '../src/lib/questionEngine.ts';
import { shouldShowGuestImport } from '../src/lib/guestImportPolicy.ts';
import type { Question } from '../src/types/learning.ts';

const questions=initialUnit.lessons.flatMap(lesson=>lesson.questions);
test('guest progress prompt requires explicit action and never returns after dismiss or successful import',()=>{
  for(const hasAccount of [false,true]) assert.equal(shouldShowGuestImport(null,hasAccount,false,4),false);
  assert.equal(shouldShowGuestImport('preview',false,false,4),true);
  assert.equal(shouldShowGuestImport('account',false,false,4),false);
  assert.equal(shouldShowGuestImport('account',true,false,4),true);
  assert.equal(shouldShowGuestImport('account',true,true,4),false);
  assert.equal(shouldShowGuestImport('preview',true,false,0),false);
});
test('automatic synchronization notice contains no guest import controls',async()=>{
  const source=await readFile(new URL('../src/components/learning/SyncNotice.tsx',import.meta.url),'utf8');
  assert.doesNotMatch(source,/importAvailable|importGuest|Há progresso de visitante/);
});
test('classification accepts repeated category targets, rejects unknown entries and waits for every item',()=>{
  const q=questions.find(item=>item.type === 'classify')!;
  assert.equal(canVerify(q,{}),false);
  assert.equal(canVerify(q,{'1':'1'}),false);
  assert.equal(isValidAnswer(q,{'1':'unknown'}),false);
  assert.equal(isValidAnswer(q,{unknown:'1'}),false);
  assert.equal(evaluateQuestion(q,q.correctAnswer),true);
  assert.equal(canVerify(q,{'1':'1','2':'1','3':'1','4':'1'}),true);
  assert.equal(evaluateQuestion(q,{'1':'1','2':'1','3':'1','4':'1'}),false);
});
test('sentence correction requires both a fragment and a replacement; picking the wrong fragment cannot score',()=>{
  const q=questions.find(item=>item.type === 'fix_sentence')!;
  assert.equal(canVerify(q,{fragment:'2'}),false);
  assert.equal(canVerify(q,{replacement:'1'}),false);
  assert.equal(isValidAnswer(q,{fragment:'2',replacement:'unknown'}),false);
  assert.equal(isValidAnswer(q,{...q.correctAnswer,unexpected:'1'}),false);
  assert.equal(evaluateQuestion(q,{fragment:'1',replacement:'1'}),false);
  assert.equal(evaluateQuestion(q,q.correctAnswer),true);
});
test('new content validates type-specific boundaries and summaries follow their own content card',()=>{
  for(const lesson of initialUnit.lessons) for(const [index,q] of lesson.questions.entries()) {
    if(q.type === 'story_summary') { assert.equal(lesson.questions[index-1]?.type,'content_card');assert.equal(lesson.questions[index-1]?.id,q.contentId); }
  }
  const changed=(type:Question['type'],fields:Record<string,unknown>)=>({...questions.find(q=>q.type === type)!,...fields}) as Question;
  assert.equal(isValidQuestion(changed('sequence',{sequence:['A',null,null]})),false);
  assert.equal(isValidQuestion(changed('before_after',{options:[{id:'1',label:'One'}]})),false);
  assert.equal(isValidQuestion(changed('classify',{categories:[{id:'1',label:'One'},{id:'1',label:'Two'}]})),false);
  assert.equal(isValidQuestion(changed('quote_character',{source:''})),false);
  assert.equal(isValidQuestion(changed('cause_effect',{relation:'unknown'})),false);
});
