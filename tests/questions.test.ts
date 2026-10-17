import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialUnit } from '../src/data/lessons.ts';
import { canVerify, correctResponse, evaluateQuestion, isValidAnswer, isValidQuestion } from '../src/lib/questionEngine.ts';
import { createAttempt, reduceAttempt, scoreAnswers } from '../src/lib/lessonEngine.ts';
import { completeLesson, parseProgress } from '../src/lib/learningProgress.ts';
import type { Lesson, Question, QuestionAnswer } from '../src/types/learning.ts';
import { answersFor, wrongAnswer } from './learningFixtures.ts';

const questions = initialUnit.lessons.flatMap(lesson => lesson.questions);
function oneQuestion(question: Question): Lesson {
  return { ...initialUnit.lessons[0]!, questions: [question] };
}
for (const type of ['multiple_choice', 'fill_blank', 'matching', 'ordering', 'true_false', 'multi_select', 'who_am_i','odd_one_out','fix_sentence','before_after','sequence','classify','cause_effect','quote_character','spot_the_error','story_summary'] as const) {
  const question = questions.find(item => item.type === type)!;
  test(`${type}: correct, wrong, invalid and missing answers have distinct validation`, () => {
    assert.ok(isValidQuestion(question));
    assert.equal(canVerify(question, null), false);
    assert.equal(canVerify(question, undefined), false);
    assert.equal(canVerify(question, 1), false);
    assert.equal(evaluateQuestion(question, {}), false);
    assert.equal(evaluateQuestion(question, question.correctAnswer), true);
    assert.equal(canVerify(question, wrongAnswer(question)), true);
    assert.equal(evaluateQuestion(question, wrongAnswer(question)), false);
    assert.ok(correctResponse(question).trim().length > 0);
  });
  test(`${type}: engine freezes and scores exactly one exercise after verification`, () => {
    const lesson = oneQuestion(question);
    const empty = createAttempt();
    assert.equal(reduceAttempt(lesson, empty, { type: 'verify' }), empty);
    let state = reduceAttempt(lesson, empty, { type: 'answer', answer: question.correctAnswer });
    state = reduceAttempt(lesson, state, { type: 'verify' });
    assert.equal(state.phase, 'feedback');
    assert.equal(reduceAttempt(lesson, state, { type: 'answer', answer: wrongAnswer(question) }), state);
    assert.equal(reduceAttempt(lesson, state, { type: 'verify' }), state);
    assert.deepEqual(scoreAnswers(lesson, state.answers), { correct: 1, total: 1, accuracy: 100 });
    assert.equal(reduceAttempt(lesson, state, { type: 'continue' }).phase, 'finished');
  });
}
test('matching accepts partial pairs, rejects unknown IDs and duplicate right targets, and requires all pairs', () => {
  const question = questions.find(item => item.type === 'matching')!;
  assert.equal(isValidAnswer(question, {}), true);
  assert.equal(canVerify(question, {}), false);
  assert.equal(canVerify(question, { '1': '2' }), false);
  for (const answer of [{ unknown: '1' }, { '1': 'unknown' }, { '1': '2', '2': '2' }, ['1', '2', '3']]) assert.equal(isValidAnswer(question, answer), false);
  const partial = reduceAttempt(oneQuestion(question), createAttempt(), { type: 'answer', answer: { '1': '2' } });
  assert.equal(reduceAttempt(oneQuestion(question), partial, { type: 'verify' }), partial);
});
test('ordering rejects duplicated/missing/unknown items and evaluates position rather than membership', () => {
  const question = questions.find(item => item.type === 'ordering')!;
  assert.equal(isValidAnswer(question, []), true);
  assert.equal(canVerify(question, []), false);
  assert.equal(isValidAnswer(question, ['2', '3']), true);
  assert.equal(canVerify(question, ['2', '3']), false);
  for (const answer of [['1', '1', '2'], ['1', '2', 'unknown'], '1', { '1': '2' }]) assert.equal(isValidAnswer(question, answer), false);
  assert.equal(evaluateQuestion(question, ['1', '2', '3']), false);
  assert.equal(evaluateQuestion(question, ['2', '3', '1']), true);
});
test('multi_select is order-independent and requires the exact set without missing or extra choices', () => {
  const question = questions.find(item => item.type === 'multi_select')!;
  assert.equal(canVerify(question, []), false);
  assert.equal(evaluateQuestion(question, [...question.correctAnswer].reverse()), true);
  assert.equal(evaluateQuestion(question, question.correctAnswer.slice(1)), false);
  assert.equal(evaluateQuestion(question, question.options.map(option => option.id)), false);
  assert.equal(isValidAnswer(question, ['1', '1']), false);
  assert.equal(isValidAnswer(question, ['unknown']), false);
  assert.equal(isValidAnswer(question, '1'), false);
});
test('mutable UI answers cannot change a draft or its verified scoring snapshot', () => {
  for (const type of ['matching', 'ordering', 'multi_select'] as const) {
    const question = questions.find(item => item.type === type)!;
    const source: QuestionAnswer = Array.isArray(question.correctAnswer) ? [...question.correctAnswer] : { ...question.correctAnswer };
    const lesson = oneQuestion(question);
    let state = reduceAttempt(lesson, createAttempt(), { type: 'answer', answer: source });
    if (Array.isArray(source)) source.length = 0;
    else if (typeof source !== 'string') Object.assign(source, { unknown: 'bad' });
    assert.ok(canVerify(question, state.answer));
    state = reduceAttempt(lesson, state, { type: 'verify' });
    assert.notEqual(state.answer, state.answers[question.id]);
    assert.equal(evaluateQuestion(question, state.answers[question.id]), true);
  }
});
test('each advance resets structured answer and no intermediate pair/item is counted as a question', () => {
  const lesson = initialUnit.lessons[0]!;
  let state = createAttempt();
  for (const [index, question] of lesson.questions.entries()) {
    assert.equal(state.answer, null);
    state = reduceAttempt(lesson, state, { type: 'answer', answer: question.correctAnswer });
    state = reduceAttempt(lesson, state, { type: 'verify' });
    assert.equal(Object.keys(state.answers).length, index + 1);
    state = reduceAttempt(lesson, state, { type: 'continue' });
  }
  assert.deepEqual(scoreAnswers(lesson, state.answers), { correct: 10, total: 10, accuracy: 100 });
});
test('legacy persisted progress/result loads without migration and reviews do not award XP again', () => {
  const lesson = initialUnit.lessons[0]!;
  const legacy = { version: 1, currentUnitId: initialUnit.id, completedLessonIds: [lesson.id], xp: 18,
    lastResult: { attemptId: 'legacy-attempt', lessonId: lesson.id, correct: 4, total: 5, accuracy: 80, xpEarned: 18, completedAt: '2026-10-05T12:00:00.000Z' } };
  const reopened = parseProgress(JSON.stringify(legacy));
  assert.deepEqual(reopened, legacy);
  const reviewed = completeLesson(reopened, lesson, answersFor(lesson), 'mixed-review', '2026-10-06T12:00:00.000Z');
  assert.equal(reviewed.xp, 18);
  assert.equal(reviewed.lastResult?.xpEarned, 0);
  assert.equal(reviewed.lastResult?.accuracy, 100);
  assert.deepEqual(reviewed.completedLessonIds, [lesson.id]);
});
test('content validator rejects broken blanks, empty clues, duplicate options and malformed solutions', () => {
  const fill = questions.find(item => item.type === 'fill_blank')!;
  const who = questions.find(item => item.type === 'who_am_i')!;
  const matching = questions.find(item => item.type === 'matching')!;
  assert.equal(isValidQuestion({ ...fill, sentence: 'No blank' }), false);
  assert.equal(isValidQuestion({ ...fill, sentence: '{{blank}} {{blank}}' }), false);
  assert.equal(isValidQuestion({ ...who, clues: [''] }), false);
  assert.equal(isValidQuestion({ ...matching, rightOptions: [{ id: '1', label: 'Only one' }] }), false);
  assert.equal(isValidQuestion({ ...fill, options: [fill.options[0]!, fill.options[0]!] }), false);
});
