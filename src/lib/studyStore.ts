import type { Lesson, LessonAnswers, LessonResult, Unit } from '../types/learning.ts';
import type { LessonAttempt } from './lessonEngine.ts';
import { canVerify, evaluateQuestion, isValidAnswer } from './questionEngine.ts';

export type StudyEntry = { result: LessonResult; day: string; mistakes: string[] };
export type LessonDraft = { attemptId: string; fingerprint: string; state: LessonAttempt; updatedAt: string };
export type StudyState = { version: 1; scope: string; drafts: Record<string, LessonDraft>; history: StudyEntry[] };
type Storage = { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<void> };
export const studyKey = (scope: string) => `arca.study.${scope}.v1`;
export const lessonFingerprint = (lesson: Lesson) => JSON.stringify(lesson.questions);
export function localDay(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const integer = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
export function validStudyResult(value: unknown): value is LessonResult {
  return record(value) && typeof value.attemptId === 'string' && !!value.attemptId && typeof value.lessonId === 'string'
    && integer(value.correct) && integer(value.total) && value.total > 0 && value.correct <= value.total
    && value.accuracy === Math.round(value.correct / value.total * 100) && integer(value.xpEarned)
    && typeof value.completedAt === 'string' && Number.isFinite(Date.parse(value.completedAt));
}
export function restoredDraft(lesson: Lesson, draft: LessonDraft | undefined): LessonDraft | null {
  if (!draft || draft.fingerprint !== lessonFingerprint(lesson) || typeof draft.attemptId !== 'string' || !draft.attemptId || !record(draft.state)) return null;
  const s = draft.state;
  const n = lesson.questions.length;
  if (!integer(s.index) || s.index >= n || !integer(s.turn) || s.turn > 1000000
    || !['answering', 'feedback'].includes(s.phase) || !record(s.answers) || !Array.isArray(s.mastered)
    || new Set(s.mastered).size !== s.mastered.length
    || s.mastered.some(id => !lesson.questions.some(q => q.id === id && q.type !== 'content_card'))
    || !(s.remaining === null || Array.isArray(s.remaining) && new Set(s.remaining).size === s.remaining.length
      && s.remaining.every(i => integer(i) && i < n && i !== s.index))) return null;
  if (Object.entries(s.answers).some(([id, answer]) => { const q = lesson.questions.find(q => q.id === id); return !q || !canVerify(q, answer); })) return null;
  const question = lesson.questions[s.index]!;
  if (s.answer !== null && !isValidAnswer(question, s.answer) || s.phase === 'feedback' && !canVerify(question, s.answer)) return null;
  if (s.phase === 'feedback' && !Object.hasOwn(s.answers, question.id)) return null;
  return JSON.parse(JSON.stringify(draft)) as LessonDraft;
}
function empty(scope: string): StudyState { return { version: 1, scope, drafts: {}, history: [] }; }
function parse(raw: string | null, scope: string): StudyState {
  if (!raw) return empty(scope);
  const value: unknown = JSON.parse(raw);
  if (!record(value) || value.version !== 1 || value.scope !== scope || !record(value.drafts) || !Array.isArray(value.history)
    || value.history.length > 500 || value.history.some(entry => !record(entry) || !validStudyResult(entry.result)
      || typeof entry.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(entry.day) || !Array.isArray(entry.mistakes) || entry.mistakes.some(id => typeof id !== 'string'))
    || new Set(value.history.map(entry => entry.result.attemptId)).size !== value.history.length) throw new Error('study_storage_invalid');
  return value as StudyState;
}
export function createStudyStore(storage: Storage, scope: string) {
  let state: StudyState | null = null;
  let queue: Promise<unknown> = Promise.resolve();
  function serial<T>(work: () => Promise<T>): Promise<T> { const next = queue.then(work); queue = next.catch(() => undefined); return next; }
  function current(): StudyState { if (!state) throw new Error('study_not_ready'); return state; }
  async function commit(next: StudyState) { await storage.setItem(studyKey(scope), JSON.stringify(next)); state = next; return next; }
  return {
    load: () => serial(async () => { state = parse(await storage.getItem(studyKey(scope)), scope); return state; }),
    getState: current,
    saveDraft: (lesson: Lesson, attemptId: string, attempt: LessonAttempt) => serial(async () => {
      const value = current();
      if (value.history.some(entry => entry.result.attemptId === attemptId)) return value;
      const draft: LessonDraft = { attemptId, fingerprint: lessonFingerprint(lesson), state: attempt, updatedAt: new Date().toISOString() };
      if (!restoredDraft(lesson, draft)) throw new Error('study_draft_invalid');
      return commit({ ...value, drafts: { ...value.drafts, [lesson.id]: JSON.parse(JSON.stringify(draft)) as LessonDraft } });
    }),
    discard: (id: string) => serial(async () => { const value = current(); const drafts = { ...value.drafts }; delete drafts[id]; return commit({ ...value, drafts }); }),
    complete: (result: LessonResult, lesson?: Lesson, answers?: LessonAnswers) => serial(async () => {
      if (!validStudyResult(result)) throw new Error('study_result_invalid');
      const value = current();
      const drafts = { ...value.drafts };
      if (drafts[result.lessonId]?.attemptId === result.attemptId) delete drafts[result.lessonId];
      const old = value.history.find(entry => entry.result.attemptId === result.attemptId);
      const mistakes = lesson && answers ? lesson.questions.filter(q => q.type !== 'content_card' && !evaluateQuestion(q, answers[q.id])).map(q => q.id) : old?.mistakes ?? [];
      const entry = { result, mistakes, day: old?.day ?? localDay(new Date(result.completedAt)) };
      return commit({ ...value, drafts, history: [...value.history.filter(item => item.result.attemptId !== result.attemptId), entry]
        .sort((a, b) => Date.parse(b.result.completedAt) - Date.parse(a.result.completedAt)).slice(0, 500) });
    }),
    mergeHistory: (results: readonly LessonResult[]) => serial(async () => {
      const value = current();
      const entries = new Map(value.history.map(entry => [entry.result.attemptId, entry]));
      for (const result of results) {
        if (!validStudyResult(result)) continue;
        const old = entries.get(result.attemptId);
        entries.set(result.attemptId, { result, day: old?.day ?? localDay(new Date(result.completedAt)), mistakes: old?.mistakes ?? [] });
      }
      return commit({ ...value, history: [...entries.values()].sort((a,b) => Date.parse(b.result.completedAt) - Date.parse(a.result.completedAt)).slice(0,500) });
    }),
  };
}
export function dailyExercises(history: readonly StudyEntry[], day = localDay()): number {
  return history.filter(entry => entry.day === day).reduce((total, entry) => total + entry.result.total, 0);
}
const intervals = [1, 3, 7, 14, 30];
export function reviewSchedule(history: readonly StudyEntry[], lessonId: string) {
  const entries = history.filter(entry => entry.result.lessonId === lessonId).sort((a,b) => Date.parse(a.result.completedAt) - Date.parse(b.result.completedAt));
  if (!entries.length) return null;
  let step = 0;
  let dueAt=0;
  entries.forEach((entry, index) => {
    const reviewedAt=Date.parse(entry.result.completedAt);
    step=entry.result.accuracy < 80 ? 0 : index > 0 && reviewedAt >= dueAt ? Math.min(step+1,intervals.length-1) : step;
    dueAt=reviewedAt+intervals[step]! * 86400000;
  });
  return { dueAt, intervalDays: intervals[step]!, accuracy: entries.at(-1)!.result.accuracy };
}
export function dueReviews(history: readonly StudyEntry[], unit: Unit, completed: readonly string[], now = Date.now()) {
  return unit.lessons.filter(lesson => completed.includes(lesson.id)).map(lesson => ({ lesson, schedule: reviewSchedule(history, lesson.id) }))
    .filter(item => item.schedule !== null && item.schedule.dueAt <= now).sort((a,b) => a.schedule!.dueAt - b.schedule!.dueAt);
}
export function subjectPerformance(history: readonly StudyEntry[], unit: Unit) {
  const groups = new Map<string, { unitId: string; correct: number; total: number; attempts: number }>();
  history.forEach(entry => {
    const lesson = unit.lessons.find(lesson => lesson.id === entry.result.lessonId);
    if (!lesson) return;
    const value = groups.get(lesson.unitId) ?? { unitId: lesson.unitId, correct: 0, total: 0, attempts: 0 };
    value.correct += entry.result.correct; value.total += entry.result.total; value.attempts++;
    groups.set(value.unitId, value);
  });
  return [...groups.values()].map(value => ({ ...value, accuracy: Math.round(value.correct / value.total * 100) }));
}
