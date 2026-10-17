import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLearning } from './LearningProvider';
import { accountStorage } from '@/lib/accountStorage';
import { createStudyStore, restoredDraft, type StudyState } from '@/lib/studyStore';
import type { LessonAttempt } from '@/lib/lessonEngine';
import type { Lesson, LessonAnswers, LessonResult } from '@/types/learning';
import { loadLessonHistory } from '@/services/learning';
import { recordDiagnostic } from '@/lib/diagnostics';

type ContextValue = {
  state: StudyState | null; loading: boolean; error: string | null; retry: () => void;
  draft: (lesson: Lesson) => ReturnType<typeof restoredDraft>;
  saveDraft: (lesson: Lesson, id: string, state: LessonAttempt) => Promise<void>;
  complete: (result: LessonResult, lesson: Lesson, answers: LessonAnswers) => Promise<void>;
};
const Context = createContext<ContextValue | null>(null);
export function StudyProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const scope = session?.user.id ?? 'guest';
  return <ScopedStudy key={scope} scope={scope}>{children}</ScopedStudy>;
}
function ScopedStudy({ children, scope }: PropsWithChildren<{ scope: string }>) {
  const { progress, offline } = useLearning();
  const [store] = useState(() => createStudyStore(accountStorage, scope));
  const [state, setState] = useState<StudyState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const apply = useCallback((value: StudyState) => { if (mounted.current) { setState(value); setError(null); } }, []);
  useEffect(() => {
    let active = true;
    void store.load().then(value => { if (active) apply(value); }).catch(() => { if (active) setError('Não foi possível ler seu histórico de estudo. Seus dados não foram apagados.'); });
    return () => { active = false; };
  }, [store, apply, revision]);
  const loaded = !!state;
  const result = progress?.lastResult;
  useEffect(() => {
    if (!loaded || !result) return;
    void store.complete(result).then(apply).catch(() => { if (mounted.current) setError('O progresso está salvo, mas não foi possível atualizar o histórico neste aparelho.'); });
  }, [loaded, result, store, apply]);
  useEffect(() => {
    if (!loaded || scope === 'guest' || offline) return;
    let active = true;
    void loadLessonHistory(scope).then(results => active ? store.mergeHistory(results) : null).then(value => { if (value && active) apply(value); }).catch(() => recordDiagnostic('history_unavailable'));
    return () => { active = false; };
  }, [loaded, scope, offline, store, apply]);
  const saveDraft = useCallback(async (lesson: Lesson, id: string, attempt: LessonAttempt) => {
    try { apply(await store.saveDraft(lesson, id, attempt)); }
    catch { recordDiagnostic('draft_save_failed'); if (mounted.current) setError('Não foi possível guardar a tentativa. Continue na lição e tente novamente antes de sair.'); throw new Error('draft_save_failed'); }
  }, [store, apply]);
  const complete = useCallback(async (value: LessonResult, lesson: Lesson, answers: LessonAnswers) => { apply(await store.complete(value, lesson, answers)); }, [store, apply]);
  return <Context.Provider value={{ state, loading: !state && !error, error, retry: () => setRevision(value => value + 1), draft: lesson => restoredDraft(lesson, state?.drafts[lesson.id]), saveDraft, complete }}>{children}</Context.Provider>;
}
export function useStudy() { const value = useContext(Context); if (!value) throw new Error('StudyProvider ausente.'); return value; }
