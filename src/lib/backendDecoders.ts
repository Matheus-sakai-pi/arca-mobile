import type { AccountSnapshot } from '../types/backend.ts';
import type { LessonResult, Question, Unit } from '../types/learning.ts';
import { isValidQuestion } from './questionEngine.ts';
import { progressUnitId, validCompletedIds } from './learningProgress.ts';

export function object(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
export function integer(value: unknown): value is number { return Number.isSafeInteger(value) && typeof value === 'number' && value >= 0; }
function text(value: unknown): value is string { return typeof value === 'string' && value.trim().length > 0; }
const timestamp = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
export function decodeResult(value: unknown): LessonResult {
  if (!object(value) || !text(value.attemptId) || !text(value.lessonId) || !integer(value.correct) || !integer(value.total)
    || value.total === 0 || value.correct > value.total || value.accuracy !== Math.round(value.correct / value.total * 100)
    || !integer(value.xpEarned) || !timestamp(value.completedAt)) throw new Error('Resultado do servidor inválido.');
  return value as LessonResult;
}
function decodeQuestion(value: unknown): Question {
  if (!object(value) || !text(value.id) || !text(value.prompt) || typeof value.explanation !== 'string' || !object(value.content)) throw new Error('Exercício inválido.');
  const content = value.content;
  const types = ['multiple_choice','true_false','fill_blank','ordering','matching','multi_select','who_am_i','content_card','odd_one_out','fix_sentence','before_after','sequence','classify','cause_effect','quote_character','spot_the_error','story_summary'];
  if (typeof value.type !== 'string' || !types.includes(value.type)) throw new Error('Tipo de exercício indisponível.');
  if (value.type !== 'content_card' && (!Array.isArray(content.options) || content.options.some(option => !object(option) || !text(option.id) || !text(option.label)))) throw new Error('Alternativas inválidas.');
  const question = { ...content, id: value.id, type: value.type, prompt: value.prompt, explanation: value.explanation } as Question;
  try { if (isValidQuestion(question)) return question; } catch { /* Reject incomplete type-specific fields. */ }
  throw new Error('Conteúdo do exercício inválido.');
}
export function decodeUnit(unit: unknown, lessons: unknown, questions: unknown): Unit {
  if (!object(unit) || !text(unit.id) || !text(unit.title) || !Array.isArray(lessons) || !lessons.length || !Array.isArray(questions)) throw new Error('Unidade indisponível.');
  const decoded = lessons.map(row => {
    if (!object(row) || !text(row.id) || row.unit_id !== unit.id || !text(row.title) || typeof row.description !== 'string') throw new Error('Lição inválida.');
    const items = questions.filter(question => object(question) && question.lesson_id === row.id).map(decodeQuestion);
    if (!items.length || !items.some(question => question.type !== 'content_card') || new Set(items.map(item => item.id)).size !== items.length) throw new Error('Lição sem exercícios válidos.');
    if (items.some((item,index)=>item.type === 'story_summary' && (items[index-1]?.type !== 'content_card' || items[index-1]?.id !== item.contentId))) throw new Error('Resumo sem leitura anterior.');
    return { id: row.id, unitId: unit.id as string, title: row.title, description: row.description, questions: items };
  });
  if (new Set(decoded.map(lesson => lesson.id)).size !== decoded.length) throw new Error('Lições duplicadas.');
  return { id: unit.id, title: unit.title, lessons: decoded };
}
export function decodeSnapshot(value: unknown, userId: string, unit: Unit): AccountSnapshot {
  if (!object(value) || value.unitId !== unit.id || !integer(value.xp) || !Array.isArray(value.completedLessonIds)
    || typeof value.guestImported !== 'boolean' || !object(value.profile)) throw new Error('Progresso da conta inválido.');
  const ids = value.completedLessonIds;
  if (!validCompletedIds(ids, unit)) throw new Error('Sequência de progresso inválida.');
  const p = value.profile;
  if (p.id !== userId || !text(p.display_name) || !text(p.username) || !text(p.avatar_key) || p.xp_total !== value.xp
    || !integer(p.current_streak) || !integer(p.longest_streak) || p.longest_streak < p.current_streak
    || !(p.last_activity_date === null || (typeof p.last_activity_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.last_activity_date)))
    || !timestamp(p.created_at) || !timestamp(p.updated_at)) throw new Error('Perfil da conta inválido.');
  const result = value.lastResult === null ? null : decodeResult(value.lastResult);
  if (result && !ids.includes(result.lessonId)) throw new Error('Resultado fora do progresso.');
  const completedLessonIds = unit.lessons.filter(lesson => ids.includes(lesson.id)).map(lesson => lesson.id);
  return { progress: { version:1, currentUnitId:progressUnitId(completedLessonIds, unit), completedLessonIds,xp:value.xp,lastResult:result },
    profile: { id:userId,display_name:p.display_name,username:p.username,avatar_key:p.avatar_key,avatar_url:null,xp_total:value.xp,
      current_streak:p.current_streak,longest_streak:p.longest_streak,last_activity_date:p.last_activity_date as string|null,created_at:p.created_at,updated_at:p.updated_at },guestImported:value.guestImported };
}
