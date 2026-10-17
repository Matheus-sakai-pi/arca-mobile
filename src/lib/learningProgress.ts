import { initialUnit, legacyLessonIds, previousLessonIds, fiveQuestionLearningUnits, legacyLearningUnits } from '../data/lessons.ts';
import type { LearningProgress, Lesson, LessonAnswers, LessonResult, LessonStatus, Unit } from '../types/learning.ts';
import { calculateXP, scoreAnswers } from './lessonEngine.ts';
import { canVerify } from './questionEngine.ts';

const historicalLessons = [...fiveQuestionLearningUnits, ...legacyLearningUnits].flatMap(unit => unit.lessons);
export function lessonForAnswers(lesson: Lesson, answers: LessonAnswers): Lesson {
  const candidates = [lesson, ...historicalLessons.filter(item => item.id === lesson.id)];
  const matched = candidates.find(item => item.questions.length === Object.keys(answers).length && item.questions.every(question => canVerify(question, answers[question.id])));
  if (!matched) throw new Error('Respostas locais inválidas.');
  return matched;
}
function validResultTotal(lessonId: string, total: number, unit: Unit): boolean {
  return [...unit.lessons, ...historicalLessons].some(lesson => lesson.id === lessonId && lesson.questions.filter(question => question.type !== 'content_card').length === total);
}

export const PROGRESS_KEY = 'arca.learning.v1';
export function progressUnitId(completed: readonly string[], unit: Unit): string {
  return unit.lessons.find(lesson => !completed.includes(lesson.id))?.unitId ?? unit.lessons.at(-1)?.unitId ?? unit.id;
}
export function validCompletedIds(ids: readonly unknown[], unit: Unit): ids is readonly string[] {
  if (new Set(ids).size !== ids.length || ids.some(id => !unit.lessons.some(lesson => lesson.id === id))) return false;
  const canonical = unit.lessons.filter(lesson => ids.includes(lesson.id)).map(lesson => lesson.id);
  const prefix = canonical.every((id, index) => unit.lessons[index]?.id === id);
  if (prefix) return true;
  if (unit.id !== initialUnit.id) return false;
  // A saved prefix of either historical curriculum can contain gaps after new
  // lessons are inserted. Only sequential additions to that prefix are accepted.
  return [legacyLessonIds, previousLessonIds].some(order => order.some((_id, index) => {
    const baseline = order.slice(0, index + 1);
    if (!baseline.every(id => ids.includes(id))) return false;
    const additions = canonical.filter(id => !baseline.includes(id));
    const remaining = unit.lessons.filter(lesson => !baseline.includes(lesson.id));
    return additions.every((id, position) => remaining[position]?.id === id);
  }));
}
export function createProgress(unit: Unit = initialUnit): LearningProgress {
  return { version: 1, currentUnitId: unit.id, completedLessonIds: [], xp: 0, lastResult: null };
}
export function nextLesson(progress: LearningProgress, unit: Unit = initialUnit): Lesson | undefined {
  return unit.lessons.find(lesson => !progress.completedLessonIds.includes(lesson.id));
}
export function lessonStatus(progress: LearningProgress, lessonId: string, activeLessonId: string | null = null, unit: Unit = initialUnit): LessonStatus {
  if (progress.completedLessonIds.includes(lessonId)) return 'completed';
  if (nextLesson(progress,unit)?.id !== lessonId) return 'locked';
  return progress.completedLessonIds.length > 0 || activeLessonId === lessonId ? 'current' : 'available';
}
export function completeLesson(progress: LearningProgress, lesson: Lesson, answers: LessonAnswers, attemptId: string, completedAt: string, unit: Unit = initialUnit, legacyOutbox = false): LearningProgress {
  const legacyPending = legacyOutbox && [legacyLessonIds, previousLessonIds].some(order => {
    const index = order.indexOf(lesson.id);
    return index >= 0 && order.slice(0, index).every(id => progress.completedLessonIds.includes(id));
  });
  if (lessonStatus(progress, lesson.id,null,unit) === 'locked' && !legacyPending) throw new Error('Conclua a lição anterior primeiro.');
  if (progress.lastResult?.attemptId === attemptId) return progress;
  const score = scoreAnswers(lesson, answers);
  const review = progress.completedLessonIds.includes(lesson.id);
  const result: LessonResult = { ...score, lessonId: lesson.id, attemptId, completedAt, xpEarned: review ? 0 : calculateXP(score.correct, score.total) };
  const completedLessonIds = unit.lessons.filter(item => progress.completedLessonIds.includes(item.id) || item.id === lesson.id).map(item => item.id);
  return { ...progress, currentUnitId: progressUnitId(completedLessonIds, unit), completedLessonIds, xp: progress.xp + result.xpEarned, lastResult: result };
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function integer(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
export function parseProgress(raw: string | null, unit: Unit = initialUnit): LearningProgress {
  if (raw === null) return createProgress(unit);
  const data: unknown = JSON.parse(raw);
  if (!record(data) || data.version !== 1 || ![unit.id, ...unit.lessons.map(lesson => lesson.unitId)].includes(data.currentUnitId as string) || !integer(data.xp) || !Array.isArray(data.completedLessonIds)) throw new Error('Progresso local inválido.');
  const completed = data.completedLessonIds;
  const maximumXP = unit.lessons.filter(lesson => completed.includes(lesson.id)).reduce((sum, lesson) => { const n = lesson.questions.filter(q=>q.type !== 'content_card').length; return sum + calculateXP(n,n); }, 0);
  if (!validCompletedIds(completed, unit) || data.xp > maximumXP || data.xp < completed.length * 10) throw new Error('Progresso local inválido.');
  const result = data.lastResult;
  if (result !== null) {
    if (!record(result) || typeof result.attemptId !== 'string' || !result.attemptId || typeof result.lessonId !== 'string' || !completed.includes(result.lessonId) || !integer(result.correct) || !integer(result.total) || !validResultTotal(result.lessonId, result.total, unit) || result.correct > result.total || result.accuracy !== Math.round(result.correct / result.total * 100) || !integer(result.xpEarned) || (result.xpEarned !== 0 && result.xpEarned !== calculateXP(result.correct, result.total)) || typeof result.completedAt !== 'string' || !Number.isFinite(Date.parse(result.completedAt))) throw new Error('Resultado local inválido.');
  } else if (completed.length > 0) throw new Error('Resultado local ausente.');
  const completedLessonIds = unit.lessons.filter(lesson => completed.includes(lesson.id)).map(lesson => lesson.id);
  return { version: 1, currentUnitId: progressUnitId(completedLessonIds, unit), xp: data.xp, completedLessonIds, lastResult: result as LessonResult | null };
}

type Storage = { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<void> };
// Commit the entire snapshot only after storage succeeds; serialize writes to avoid lost XP.
export function createLearningStore(storage: Storage, unit: Unit = initialUnit) {
  let snapshot: LearningProgress | null = null;
  let queue: Promise<unknown> = Promise.resolve();
  return {
    async load() { snapshot = parseProgress(await storage.getItem(PROGRESS_KEY),unit); return snapshot; },
    complete(lesson: Lesson, answers: LessonAnswers, attemptId: string) {
      const operation = queue.then(async () => {
        if (!snapshot) throw new Error('O progresso ainda não foi carregado.');
        const next = completeLesson(snapshot, lesson, answers, attemptId, new Date().toISOString(),unit);
        if (next !== snapshot) await storage.setItem(PROGRESS_KEY, JSON.stringify(next));
        snapshot = next;
        return next;
      });
      queue = operation.catch(() => undefined);
      return operation;
    },
  };
}
