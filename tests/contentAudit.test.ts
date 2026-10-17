import assert from 'node:assert/strict';
import { test } from 'node:test';
import { auditCurriculum } from '../scripts/audit-curriculum.ts';
import { learningUnits } from '../src/data/lessons.ts';
test('every shipped exercise has unambiguous options, a valid solution, reading references and per-lesson variety',()=>{
  const audit=auditCurriculum(learningUnits);
  assert.equal(audit.units,10);assert.equal(audit.lessons,100);assert.equal(audit.exercises,1000);
  assert.deepEqual(audit.issues,[]);
});
