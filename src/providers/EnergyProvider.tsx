import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { ENERGY_CONFIG } from '@/config/energy';
import { monotonicNow, resumeEnergyDraft, type EnergyState } from '@/lib/energy';
import { energyRepository } from '@/services/energy';
import type { LessonDraft } from '@/lib/studyStore';
import type { Lesson, QuestionAnswer } from '@/types/learning';
import type { Json } from '@/types/backend';

type Context = { status: EnergyState | null; receivedAt: number; error: string | null; loading: boolean;
  refresh: () => Promise<void>;
  open: (lesson: Lesson, local: LessonDraft | null) => Promise<{ status: EnergyState; draft: LessonDraft }>;
  answer: (lesson: string, attempt: string, question: string, answer: QuestionAnswer, turn: number) => Promise<EnergyState>;
  chest: (unit: string, claim?: boolean) => Promise<EnergyState>;
  finish: (lesson: string, attempt: string) => Promise<void> };
const EnergyContext = createContext<Context | null>(null);
export function EnergyProvider({ children }: PropsWithChildren) {
  const { session, isGuest } = useAuth();
  const owner = session?.user.id ?? 'guest';
  return <ScopedEnergy key={owner} owner={owner} enabled={!!session || isGuest}>{children}</ScopedEnergy>;
}
function ScopedEnergy({ children, owner, enabled }: PropsWithChildren<{ owner: string; enabled: boolean }>) {
  const [status, setStatus] = useState<EnergyState | null>(null);
  const [receivedAt, setReceivedAt] = useState(monotonicNow);
  const [error, setError] = useState<string | null>(null), [loading, setLoading] = useState(true);
  const active = useRef(true), sequence = useRef(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const refreshing = useRef<Promise<void> | null>(null);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const call = useCallback((args: Parameters<ReturnType<typeof energyRepository>['call']>[0], reportError = true) => {
    const task = queue.current.then(async () => {
      if (!active.current) throw new Error('Sua conta mudou. Abra a lição novamente.');
      const version = ++sequence.current;
      try {
        const next = await energyRepository(owner).call(args);
        if (active.current && sequence.current === version) { setStatus(next); setReceivedAt(monotonicNow()); setError(null); setLoading(false); }
        return next;
      } catch (cause) {
        if (active.current && sequence.current === version && reportError) { setError(cause instanceof Error ? cause.message : 'Não foi possível conferir sua bateria.'); setLoading(false); }
        throw cause;
      }
    });
    queue.current = task.catch(() => undefined);
    return task;
  }, [owner]);
  const refresh = useCallback(() => {
    if (refreshing.current) return refreshing.current;
    const task = call({ p_action: 'status' }).then(() => undefined).catch(() => undefined).finally(() => { refreshing.current = null; });
    refreshing.current = task;
    return task;
  }, [call]);
  useEffect(() => {
    if (!enabled) return;
    let current = true;
    void Promise.resolve().then(() => { if (current) void refresh(); });
    const timer = setInterval(() => void refresh(), ENERGY_CONFIG.pollSeconds * 1000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    return () => { current = false; clearInterval(timer); subscription.remove(); };
  }, [enabled, refresh]);
  const open = useCallback(async (lesson: Lesson, local: LessonDraft | null) => {
    const attempt = local?.attemptId ?? `${lesson.id}:${Date.now()}`;
    const next = await call({ p_action: 'open', p_lesson: lesson.id, p_attempt: attempt, ...(local ? { p_resume: local.state.answers as Json } : {}) });
    return { status: next, draft: resumeEnergyDraft(lesson, next, local) };
  }, [call]);
  const answer = useCallback((lesson: string, attempt: string, question: string, value: QuestionAnswer, turn: number) => call({ p_action: 'answer', p_lesson: lesson, p_attempt: attempt, p_question: question, p_answer: value as Json, p_turn: turn }), [call]);
  const finish = useCallback(async (lesson: string, attempt: string) => { await call({ p_action: 'finish', p_lesson: lesson, p_attempt: attempt }); }, [call]);
  const chest = useCallback((unit: string, claim = false) => call({ p_action: claim ? 'chest_claim' : 'chest_status', p_lesson: unit }, false), [call]);
  return <EnergyContext.Provider value={{ status, receivedAt, error, loading, refresh, open, answer, finish, chest }}>{children}</EnergyContext.Provider>;
}
export function useEnergy() { const context = useContext(EnergyContext); if (!context) throw new Error('EnergyProvider ausente.'); return context; }
