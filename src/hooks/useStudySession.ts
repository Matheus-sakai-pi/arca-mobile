import { useEffect } from 'react';
import { useAuth } from './useAuth';
import { scopedSupabase, supabase } from '@/lib/supabase';
import { recordDiagnostic } from '@/lib/diagnostics';

export function useStudySession(lesson: string, attempt: string, turn: number) {
  const { session } = useAuth();
  const owner = session?.user.id;
  useEffect(() => {
    if (!owner || !supabase) return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    void (async () => {
      try {
        const { error } = await scopedSupabase(supabase, owner)
          .rpc('record_study_session', { p_lesson: lesson, p_attempt: attempt })
          .abortSignal(controller.signal);
        if (error && !controller.signal.aborted) recordDiagnostic('study_session_unavailable');
      } catch {
        if (!controller.signal.aborted) recordDiagnostic('study_session_unavailable');
      } finally {
        clearTimeout(timer);
      }
    })();
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [owner, lesson, attempt, turn]);
}
