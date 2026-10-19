import { integer, object } from './backendDecoders.ts';
import { ENERGY_CONFIG } from '../config/energy.ts';
import { createAttempt, reduceAttempt, type LessonAttempt } from './lessonEngine.ts';
import { lessonFingerprint, restoredDraft, type LessonDraft } from './studyStore.ts';
import type { Lesson } from '../types/learning.ts';

export const ENERGY_MAX = ENERGY_CONFIG.capacity;
export const ENERGY_INTERVAL = ENERGY_CONFIG.refillSeconds * 1000;
export type EnergyRules = Omit<typeof ENERGY_CONFIG, 'bonusOverflow'> & { bonusOverflow: boolean };
export type EnergyBonus = { kind: string; rolled: number; amount: number };
export type EnergyReceipt = { key: string; turn: number; correct: boolean; charged: number; bonuses: EnergyBonus[] };
export type EnergySession = { attemptId: string; draft: LessonAttempt | null; nextQuestionId: string | null; nextTurn: number; remainingNew: number; streak: number; legacy: boolean };
export type EnergyChest = { unitId: string; completed: number; total: number; target: number; min: number; max: number; eligible: boolean; claimed: boolean; reward: { rolled: number; amount: number; claimedAt: string } | null };
export type EnergyState = { version: number; owner: string; available: boolean; enabled: boolean; balance: number; nextRefillAt: string | null; serverNow: string; rules: EnergyRules; allowed: boolean; receipt: EnergyReceipt | null; session: EnergySession | null; chest?: EnergyChest; unlimited?: boolean };
export const monotonicNow = () => globalThis.performance?.now() ?? 0;
const iso = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));

export function decodeEnergyChest(value: unknown): EnergyChest {
  if (!object(value) || typeof value.unitId !== 'string' || !value.unitId || !integer(value.completed) || !integer(value.total) || value.total < 1
    || value.completed > value.total || !integer(value.target) || value.target < 1 || value.target > value.total || !integer(value.min) || value.min < 1 || !integer(value.max) || value.max < value.min
    || typeof value.eligible !== 'boolean' || value.eligible !== (value.completed >= value.target) || typeof value.claimed !== 'boolean') throw new Error('Não foi possível confirmar o baú. Atualize para conferir.');
  const reward = value.reward;
  if (value.claimed ? !object(reward) || !integer(reward.rolled) || reward.rolled < value.min || reward.rolled > value.max || !integer(reward.amount) || reward.amount > reward.rolled || !iso(reward.claimedAt) : reward !== null) throw new Error('Recibo do baú inválido. Atualize para conferir.');
  return value as EnergyChest;
}

export function decodeEnergy(value: unknown, owner: string): EnergyState {
  if (object(value) && value.unlimited !== undefined && typeof value.unlimited !== 'boolean') throw new Error('Benefício de bateria inválido.');
  if (!object(value) || value.version !== ENERGY_CONFIG.version || value.owner !== owner || value.available !== true || typeof value.enabled !== 'boolean'
    || !integer(value.balance) || !iso(value.serverNow) || !(value.nextRefillAt === null || iso(value.nextRefillAt)) || typeof value.allowed !== 'boolean' || !object(value.rules)) throw new Error('Saldo de energia inválido. Atualize para conferir.');
  const rules = value.rules;
  for (const key of ['version', 'capacity', 'exerciseCost', 'refillSeconds', 'streakBonusMin', 'streakBonusMax', 'perfectBonus', 'minimumDraftHours', 'pollSeconds', 'legacyCapacity', 'legacyRefillSeconds']) if (!integer(rules[key])) throw new Error('Configuração de energia inválida.');
  if (rules.version !== ENERGY_CONFIG.version || Number(rules.capacity) < 1 || Number(rules.refillSeconds) < 1 || Number(rules.pollSeconds) < 1 || Number(rules.streakBonusMin) > Number(rules.streakBonusMax)
    || typeof rules.bonusOverflow !== 'boolean' || !rules.bonusOverflow && value.balance > Number(rules.capacity)
    || !Array.isArray(rules.streakMilestones) || rules.streakMilestones.some(n => !integer(n) || n === 0)
    || new Set(rules.streakMilestones).size !== rules.streakMilestones.length
    || value.balance >= Number(rules.capacity) && value.nextRefillAt !== null || value.balance < Number(rules.capacity) && value.nextRefillAt === null) throw new Error('Configuração de energia inválida.');
  if (value.receipt !== null && value.receipt !== undefined) {
    const receipt = value.receipt;
    if (!object(receipt) || typeof receipt.key !== 'string' || !integer(receipt.turn) || typeof receipt.correct !== 'boolean' || !integer(receipt.charged) || !Array.isArray(receipt.bonuses)
      || receipt.bonuses.some(b => !object(b) || typeof b.kind !== 'string' || !integer(b.rolled) || !integer(b.amount) || Number(b.amount) > Number(b.rolled))) throw new Error('Recibo de energia inválido.');
  }
  if (value.session !== null && value.session !== undefined) {
    const s = value.session;
    if (!object(s) || typeof s.attemptId !== 'string' || !s.attemptId || !integer(s.nextTurn) || !integer(s.remainingNew) || !integer(s.streak)
      || !(s.nextQuestionId === null || typeof s.nextQuestionId === 'string') || !(s.draft === null || object(s.draft))) throw new Error('Tentativa de energia inválida.');
  }
  return { ...value, receipt: value.receipt ?? null, session: value.session ?? null, ...(value.chest !== undefined ? { chest: decodeEnergyChest(value.chest) } : {}) } as EnergyState;
}

export function energyWait(state: Pick<EnergyState, 'serverNow' | 'nextRefillAt'>, receivedAt: number, now = monotonicNow()): string {
  if (!state.nextRefillAt) return 'Energia completa';
  const seconds = Math.ceil(Math.max(0, Date.parse(state.nextRefillAt) - Date.parse(state.serverNow) - Math.max(0, now - receivedAt)) / 1000);
  return seconds === 0 ? 'Atualize para conferir a recarga' : energyIntervalText(seconds);
}
export function energyIntervalText(seconds: number = ENERGY_CONFIG.refillSeconds): string {
  const hours = Math.floor(seconds / 3600), minutes = Math.floor(seconds % 3600 / 60), rest = seconds % 60;
  return [hours ? `${hours}h` : '', minutes ? `${minutes}min` : '', rest ? `${rest}s` : ''].filter(Boolean).join(' ') || '0s';
}
export function resumeEnergyDraft(lesson: Lesson, status: EnergyState, local: LessonDraft | null): LessonDraft {
  const session = status.session;
  if (!session) throw new Error('Não foi possível recuperar sua tentativa.');
  let state = session.draft ?? createAttempt();
  if (session.legacy && local?.attemptId === session.attemptId && restoredDraft(lesson, local)) return local;
  if (session.draft) {
    const wrapper = { attemptId: session.attemptId, state, fingerprint: lessonFingerprint(lesson), updatedAt: status.serverNow };
    if (!restoredDraft(lesson, wrapper)) throw new Error('Sua tentativa precisa ser conferida com o conteúdo atual.');
    if (local?.attemptId === session.attemptId && local.state.turn === session.nextTurn && local.state.phase === 'answering') {
      const last = lesson.questions[state.index];
      const next = reduceAttempt(lesson, state, { type: last?.type === 'content_card' ? 'read' : 'continue' });
      if (next.phase === 'answering' && lesson.questions[next.index]?.id === session.nextQuestionId) state = next;
    }
  }
  if (state.phase === 'answering' && local?.attemptId === session.attemptId && local.state.turn === state.turn && local.state.index === state.index && local.state.answer !== null) {
    state = reduceAttempt(lesson, state, { type: 'answer', answer: local.state.answer });
  }
  return { attemptId: session.attemptId, fingerprint: lessonFingerprint(lesson), updatedAt: status.serverNow, state };
}
