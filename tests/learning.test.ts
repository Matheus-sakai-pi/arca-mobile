import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialUnit, learningUnits, legacyLessonIds, previousLessonIds, previousLearningUnits, combineUnits } from '../src/data/lessons.ts';
import { calculateXP, createAttempt, reduceAttempt, scoreAnswers } from '../src/lib/lessonEngine.ts';
import { completeLesson, createLearningStore, createProgress, lessonStatus, nextLesson, parseProgress, PROGRESS_KEY } from '../src/lib/learningProgress.ts';
import { isValidQuestion } from '../src/lib/questionEngine.ts';
import { answersFor } from './learningFixtures.ts';

const first = initialUnit.lessons[0]!;
const second = initialUnit.lessons[1]!;
const date = '2026-10-05T12:00:00.000Z';

test('ten units have ten lessons and one hundred graded exercises each; all exercises and sixteen formats validate', () => {
  assert.equal(initialUnit.lessons.length, 100);
  assert.equal(new Set(initialUnit.lessons.map(lesson => lesson.id)).size, 100);
  assert.equal(learningUnits.length,10);
  for (const unit of learningUnits) {
    assert.equal(unit.lessons.length,10);
    assert.equal(unit.lessons.flatMap(lesson=>lesson.questions).filter(question=>question.type !== 'content_card').length,100);
  }
  const ids = new Set<string>();
  const types = new Set<string>();
  for (const lesson of initialUnit.lessons) {
    assert.ok(learningUnits.some(unit=>unit.id === lesson.unitId));
    const graded=lesson.questions.filter(question=>question.type !== 'content_card');
    assert.equal(graded.length, 10);
    assert.ok(new Set(graded.map(question => question.type)).size >= 5);
    for (const question of lesson.questions) {
      assert.ok(!ids.has(question.id));
      ids.add(question.id);
      types.add(question.type);
      assert.ok(question.prompt && (question.type === 'content_card' || question.explanation));
      assert.equal(new Set(question.options.map(option => option.id)).size, question.options.length);
      assert.ok(isValidQuestion(question), `Invalid content: ${question.id}`);
      if (question.type === 'true_false') assert.deepEqual(question.options.map(option => option.id), ['true', 'false']);
    }
  }
  assert.equal(types.size,17);
});
test('cannot verify without selection or continue before feedback', () => {
  const attempt = createAttempt();
  assert.equal(reduceAttempt(first, attempt, { type: 'verify' }), attempt);
  assert.equal(reduceAttempt(first, attempt, { type: 'continue' }), attempt);
  assert.equal(reduceAttempt(first, attempt, { type: 'answer', answer: 'unknown' }), attempt);
});
test('feedback freezes answer, advances only once and resets selection', () => {
  let attempt = reduceAttempt(first, createAttempt(), { type: 'answer', answer: '2' });
  attempt = reduceAttempt(first, attempt, { type: 'verify' });
  assert.equal(attempt.phase, 'feedback');
  assert.equal(attempt.answers[first.questions[0]!.id], '2');
  assert.equal(reduceAttempt(first, attempt, { type: 'answer', answer: '1' }), attempt);
  assert.equal(reduceAttempt(first, attempt, { type: 'verify' }), attempt);
  attempt = reduceAttempt(first, attempt, { type: 'continue' });
  assert.equal(attempt.index, 1);
  assert.equal(attempt.answer, null);
  assert.equal(attempt.phase, 'answering');
  assert.equal(reduceAttempt(first, attempt, { type: 'continue' }), attempt);
});
test('engine finishes after all questions without an out-of-range index', () => {
  let attempt = createAttempt();
  for (const question of first.questions) {
    attempt = reduceAttempt(first, attempt, { type: 'answer', answer: question.correctAnswer });
    attempt = reduceAttempt(first, attempt, { type: 'verify' });
    attempt = reduceAttempt(first, attempt, { type: 'continue' });
  }
  assert.equal(attempt.phase, 'finished');
  assert.equal(attempt.index, 9);
  assert.deepEqual(scoreAnswers(first, attempt.answers), { correct: 10, total: 10, accuracy: 100 });
  assert.equal(reduceAttempt(first, attempt, { type: 'continue' }), attempt);
});
test('scores wrong answers and rejects missing or invalid answers', () => {
  assert.deepEqual(scoreAnswers(first, answersFor(first, 4)), { correct: 4, total: 10, accuracy: 40 });
  assert.deepEqual(scoreAnswers(first, answersFor(first, 0)), { correct: 0, total: 10, accuracy: 0 });
  assert.throws(() => scoreAnswers(first, {}));
  assert.throws(() => scoreAnswers(first, { ...answersFor(first), [first.questions[0]!.id]: 'unknown' }));
});
test('XP formula includes completion and perfect bonus only when applicable', () => {
  assert.equal(calculateXP(0, 5), 10);
  assert.equal(calculateXP(4, 5), 18);
  assert.equal(calculateXP(5, 5), 25);
});
test('first lesson available; all others locked, including direct completion', () => {
  const progress = createProgress();
  assert.equal(nextLesson(progress)?.id, first.id);
  assert.equal(lessonStatus(progress, first.id), 'available');
  assert.equal(lessonStatus(progress, first.id, first.id), 'current');
  for (const lesson of initialUnit.lessons.slice(1)) assert.equal(lessonStatus(progress, lesson.id), 'locked');
  assert.equal(lessonStatus(progress, 'unknown'), 'locked');
  assert.throws(() => completeLesson(progress, second, answersFor(second), 'locked', date));
});
test('sequential completion unlocks exactly one next lesson and survives JSON reload', () => {
  let progress = createProgress();
  for (const [index, lesson] of initialUnit.lessons.entries()) {
    progress = completeLesson(progress, lesson, answersFor(lesson), `attempt-${index}`, date);
    progress = parseProgress(JSON.stringify(progress));
    assert.equal(progress.xp, (index + 1) * 35);
    assert.equal(lessonStatus(progress, lesson.id), 'completed');
    assert.equal(progress.completedLessonIds.length, index + 1);
    const next = initialUnit.lessons[index + 1];
    if (next) assert.equal(lessonStatus(progress, next.id), 'current');
    for (const later of initialUnit.lessons.slice(index + 2)) assert.equal(lessonStatus(progress, later.id), 'locked');
  }
  assert.equal(nextLesson(progress), undefined);
  assert.equal(progress.currentUnitId, learningUnits[9]!.id);
});

test('all five legacy progress levels retain XP, conclusions and result after regrouping', () => {
  for (let count=1;count<=5;count++) {
    const ids=legacyLessonIds.slice(0,count);
    const raw={version:1,currentUnitId:initialUnit.id,completedLessonIds:ids,xp:count*25,
      lastResult:{attemptId:`old-${count}`,lessonId:ids.at(-1),correct:5,total:5,accuracy:100,xpEarned:25,completedAt:date}};
    const migrated=parseProgress(JSON.stringify(raw));
    assert.equal(migrated.xp,raw.xp);
    assert.deepEqual(new Set(migrated.completedLessonIds),new Set(ids));
    assert.deepEqual(migrated.lastResult,raw.lastResult);
    assert.deepEqual(parseProgress(JSON.stringify(migrated)),migrated);
    for (const id of ids) assert.equal(lessonStatus(migrated,id),'completed');
    assert.equal(nextLesson(migrated)?.id,count===5 ? 'lendo-referencias' : count===4 ? 'revisao' : initialUnit.lessons[count]?.id);
  }
});

test('unit two unlocks only after all ten first-unit lessons and survives persistence', () => {
  let progress=createProgress();
  const firstStory=learningUnits[1]!.lessons[0]!;
  for (const [index,lesson] of learningUnits[0]!.lessons.entries()) {
    assert.equal(lessonStatus(progress,firstStory.id),'locked');
    progress=completeLesson(progress,lesson,answersFor(lesson),`unit-one-${index}`,date);
  }
  assert.equal(lessonStatus(progress,firstStory.id),'current');
  assert.equal(parseProgress(JSON.stringify(progress)).currentUnitId,learningUnits[1]!.id);
});

test('all eight previous progress levels survive expansion and continue through every inserted lesson', () => {
  const previous = combineUnits(previousLearningUnits);
  let old = createProgress(previous);
  for (const [index, lesson] of previous.lessons.entries()) {
    old = completeLesson(old, lesson, answersFor(lesson), `previous-${index}`, date, previous);
    let expanded = parseProgress(JSON.stringify(old));
    assert.equal(expanded.xp, old.xp);
    assert.deepEqual(new Set(expanded.completedLessonIds), new Set(old.completedLessonIds));
    assert.deepEqual(expanded.lastResult, old.lastResult);
    for (const id of previousLessonIds.slice(0, index + 1)) assert.equal(lessonStatus(expanded, id), 'completed');
    while (nextLesson(expanded)) {
      const next = nextLesson(expanded)!;
      expanded = completeLesson(expanded, next, answersFor(next), `expanded-${index}-${next.id}`, date);
      expanded = parseProgress(JSON.stringify(expanded));
    }
    assert.equal(expanded.completedLessonIds.length,100);
    assert.equal(expanded.xp,old.xp + (100 - old.completedLessonIds.length) * 35);
  }
});

test('existing lessons retain their exact IDs, exercises, content and unit identities', () => {
  for (const unit of previousLearningUnits) for (const lesson of unit.lessons) {
    const expanded = initialUnit.lessons.find(item=>item.id===lesson.id)!;
    assert.deepEqual({ ...expanded, questions: expanded.questions.slice(0, lesson.questions.length) },lesson);
  }
});
test('double completion is idempotent; review records result without farming XP', () => {
  const completed = completeLesson(createProgress(), first, answersFor(first, 4), 'attempt', date);
  assert.equal(completed.xp, 18);
  assert.equal(completeLesson(completed, first, answersFor(first, 4), 'attempt', date), completed);
  const review = completeLesson(completed, first, answersFor(first), 'review', date);
  assert.equal(review.xp, 18);
  assert.equal(review.lastResult?.xpEarned, 0);
  assert.equal(review.lastResult?.accuracy, 100);
  assert.deepEqual(review.completedLessonIds, [first.id]);
  assert.deepEqual(parseProgress(JSON.stringify(review)), review);
});
test('missing storage initializes cleanly; corrupt data is rejected, never reset silently', () => {
  assert.deepEqual(parseProgress(null), createProgress());
  for (const raw of ['{', '{}', 'null', JSON.stringify({ ...createProgress(), xp: -1 }), JSON.stringify({ ...createProgress(), version: 2 }), JSON.stringify({ ...createProgress(), completedLessonIds: [second.id] })]) assert.throws(() => parseProgress(raw));
  const progress = completeLesson(createProgress(), first, answersFor(first), 'a', date);
  for (const change of [{ xp: 999 }, { lastResult: null }, { completedLessonIds: [first.id, first.id] }, { lastResult: { ...progress.lastResult, accuracy: 50 } }, { lastResult: { ...progress.lastResult, correct: 6 } }]) assert.throws(() => parseProgress(JSON.stringify({ ...progress, ...change })));
});
test('store persists complete snapshot, reloads and serializes concurrent writes', async () => {
  let raw: string | null = null;
  let writes = 0;
  const storage = { getItem: async (key: string) => { assert.equal(key, PROGRESS_KEY); return raw; }, setItem: async (key: string, value: string) => { assert.equal(key, PROGRESS_KEY); await new Promise(resolve => setTimeout(resolve, 5)); writes++; raw = value; } };
  const store = createLearningStore(storage);
  await store.load();
  const [one, duplicate, two] = await Promise.all([store.complete(first, answersFor(first), 'a'), store.complete(first, answersFor(first), 'a'), store.complete(second, answersFor(second), 'b')]);
  assert.equal(one.xp, 35);
  assert.equal(duplicate.xp, 35);
  assert.equal(two.xp, 70);
  assert.equal(writes, 2);
  const reopened = await createLearningStore(storage).load();
  assert.deepEqual(reopened, two);
});
test('storage failure does not commit XP or unlock; retry succeeds exactly once', async () => {
  let fail = true;
  let raw: string | null = null;
  const store = createLearningStore({ getItem: async () => raw, setItem: async (_key, value) => { if (fail) throw new Error('disk full'); raw = value; } });
  await assert.rejects(store.complete(first, answersFor(first), 'a'));
  await store.load();
  await assert.rejects(store.complete(first, answersFor(first), 'a'));
  assert.equal(raw, null);
  fail = false;
  const saved = await store.complete(first, answersFor(first), 'a');
  assert.equal(saved.xp, 35);
  assert.equal((await store.complete(first, answersFor(first), 'a')).xp, 35);
  assert.deepEqual(parseProgress(raw), saved);
});
