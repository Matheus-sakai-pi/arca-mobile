import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialUnit, combineUnits, fiveQuestionLearningUnits } from '../src/data/lessons.ts';
import { calculateXP, createAttempt, reduceAttempt, scoreAnswers, type LessonAttempt } from '../src/lib/lessonEngine.ts';
import { completeLesson, createLearningStore, createProgress, parseProgress } from '../src/lib/learningProgress.ts';
import { accountKey, createAccountLearningStore, parseAccountCache } from '../src/lib/accountLearningStore.ts';
import { loadAllRows } from '../src/lib/loadAllRows.ts';
import type { AccountSnapshot, LearningRepository } from '../src/types/backend.ts';
import type { Lesson, QuestionAnswer } from '../src/types/learning.ts';
import { answersFor, wrongAnswer } from './learningFixtures.ts';

function respond(lesson: Lesson, state: LessonAttempt, answer: QuestionAnswer): LessonAttempt {
  return reduceAttempt(lesson, reduceAttempt(lesson, reduceAttempt(lesson, state, { type: 'answer', answer }), { type: 'verify' }), { type: 'continue' });
}
test('wrong exercises return to the end in order until corrected; first answers determine XP', async () => {
  const lesson = initialUnit.lessons[0]!;
  let state = createAttempt();
  for (const [index, question] of lesson.questions.entries()) state = respond(lesson, state, index === 0 || index === 9 ? wrongAnswer(question) : question.correctAnswer);
  assert.equal(state.phase, 'answering'); assert.equal(state.index, 0);
  assert.deepEqual(state.remaining, [9]); assert.equal(state.mastered.length, 8);
  state = respond(lesson, state, wrongAnswer(lesson.questions[0]!));
  assert.equal(state.index, 9); assert.deepEqual(state.remaining, [0]);
  state = respond(lesson, state, lesson.questions[9]!.correctAnswer);
  assert.equal(state.index, 0); assert.equal(state.answer, null);
  state = respond(lesson, state, lesson.questions[0]!.correctAnswer);
  assert.equal(state.phase, 'finished'); assert.equal(state.mastered.length, 10);
  assert.deepEqual(scoreAnswers(lesson, state.answers), { correct: 8, total: 10, accuracy: 80 });
  assert.equal(calculateXP(8, 10), 26);
  let raw: string | null = null;
  const storage = { getItem: async () => raw, setItem: async (_key: string, value: string) => { raw = value; } };
  const store = createLearningStore(storage); await store.load();
  const done = await store.complete(lesson, state.answers, 'retry-lesson');
  assert.equal(done.xp, 26); assert.deepEqual(done.completedLessonIds, [lesson.id]);
  assert.deepEqual(await createLearningStore(storage).load(), done);
  assert.equal((await store.complete(lesson, state.answers, 'retry-lesson')).xp, 26);
});
test('all sixteen exercise formats reset and retry, including the sole remaining question', () => {
  const formats = new Map(initialUnit.lessons.flatMap(lesson => lesson.questions).filter(question => question.type !== 'content_card').map(question => [question.type, question]));
  assert.equal(formats.size, 16);
  for (const question of formats.values()) {
    const lesson: Lesson = { ...initialUnit.lessons[0]!, questions: [question] };
    let state = createAttempt();
    for (let retry = 0; retry < 4; retry++) {
      state = respond(lesson, state, wrongAnswer(question));
      assert.equal(state.phase, 'answering', question.type);
      assert.equal(state.answer, null); assert.equal(state.turn, retry + 1); assert.equal(state.index, 0);
      assert.equal(state.mastered.length, 0);
    }
    state = respond(lesson, state, question.correctAnswer);
    assert.equal(state.phase, 'finished');
    assert.deepEqual(scoreAnswers(lesson, state.answers), { correct: 0, total: 1, accuracy: 0 });
  }
});
test('reading cards are acknowledged once and never enter the retry queue', () => {
  const lesson = initialUnit.lessons.find(item => item.questions[0]?.type === 'content_card')!;
  let state = reduceAttempt(lesson, createAttempt(), { type: 'read' });
  for (const question of lesson.questions.slice(1)) state = respond(lesson, state, wrongAnswer(question));
  assert.equal(state.index, 1);
  for (const question of lesson.questions.slice(1)) state = respond(lesson, state, question.correctAnswer);
  assert.equal(state.phase, 'finished');
  assert.equal(state.answers[lesson.questions[0]!.id], 'seen');
  assert.deepEqual(scoreAnswers(lesson, state.answers), { correct: 0, total: 10, accuracy: 0 });
});
test('all 100 five-question saved progress levels survive and retain original results/XP', () => {
  const old = combineUnits(fiveQuestionLearningUnits);
  let progress = createProgress(old);
  for (const lesson of old.lessons) {
    progress = completeLesson(progress, lesson, answersFor(lesson), `old-${lesson.id}`, '2026-10-14T12:00:00Z', old);
    const restored = parseProgress(JSON.stringify(progress));
    assert.equal(restored.xp, progress.xp); assert.deepEqual(restored.lastResult, progress.lastResult);
    assert.deepEqual(restored.completedLessonIds, progress.completedLessonIds);
  }
  assert.equal(progress.xp, 2500);
});
test('five-question offline account outbox remains valid when a ten-question catalog arrives', async () => {
  const old = combineUnits(fiveQuestionLearningUnits);
  const first = old.lessons[0]!;
  const date = '2026-10-14T12:00:00Z';
  const snapshot: AccountSnapshot = { progress: createProgress(old), guestImported: false, profile: { id: 'user', display_name: 'Aprendiz', username: 'aprendiz', avatar_key: 'owl', avatar_url: null, xp_total: 0, current_streak: 0, longest_streak: 0, last_activity_date: null, created_at: date, updated_at: date } };
  const cache = { version: 1, userId: 'user', unit: old, snapshot, rejected: [], pending: [{ id: 'queued-old', lessonId: first.id, answers: answersFor(first), createdAt: date }] };
  let raw = JSON.stringify(cache);
  const storage = { getItem: async () => raw, setItem: async (_key: string, value: string) => { raw = value; } };
  const repository: LearningRepository = {
    loadUnit: async () => initialUnit, loadSnapshot: async () => snapshot,
    complete: async () => { throw new Error('offline'); }, start: async () => undefined,
    importGuest: async () => snapshot, updateProfile: async () => snapshot.profile, updateAvatar: async () => ({ avatar_key: 'owl', updated_at: date }),
  };
  const state = await createAccountLearningStore(storage, 'user', repository).load();
  assert.equal(state.unit.lessons[0]!.questions.length, 10);
  assert.equal(state.progress.xp, 25); assert.equal(state.pending, 1);
  assert.equal(state.progress.lastResult?.total, 5); assert.equal(state.profile.avatar_key, 'owl');
  assert.equal(parseAccountCache(raw, 'user').pending[0]!.id, 'queued-old');
  const restored = await createAccountLearningStore(storage, 'user', repository).load();
  assert.equal(restored.progress.xp, 25); assert.equal(restored.pending, 1);
  assert.equal(accountKey('user'), 'arca.account.user.v1');
});
test('paginated catalog reads all 1,002 rows, preserves order and rejects partial errors', async () => {
  const data = Array.from({ length: 1002 }, (_value, id) => ({ id }));
  const ranges: number[][] = [];
  const check = (error: { message: string } | null) => { if (error) throw new Error(error.message); };
  const rows = await loadAllRows(async (start, end) => { ranges.push([start, end]); return { data: data.slice(start, end + 1), error: null }; }, check);
  assert.deepEqual(rows, data); assert.deepEqual(ranges, [[0, 499], [500, 999], [1000, 1499]]);
  await assert.rejects(loadAllRows(async start => start === 0 ? { data: data.slice(0, 500), error: null } : { data: null, error: { message: 'network' } }, check), /network/);
});
