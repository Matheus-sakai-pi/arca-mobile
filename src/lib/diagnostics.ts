export type DiagnosticCode = 'render_failed' | 'draft_save_failed' | 'history_unavailable' | 'support_unavailable' | 'curriculum_loaded' | 'study_session_unavailable';
export type DiagnosticEvent = { code: DiagnosticCode; at: string; durationMs?: number };
const events: DiagnosticEvent[] = [];
export function recordDiagnostic(code: DiagnosticCode, durationMs?: number) {
  events.push({ code, at: new Date().toISOString(), ...(typeof durationMs === 'number' && Number.isFinite(durationMs) ? { durationMs: Math.min(600000, Math.max(0, Math.round(durationMs))) } : {}) });
  if (events.length > 30) events.shift();
}
export function diagnosticSnapshot(): readonly DiagnosticEvent[] { return events.map(value => ({ ...value })); }
export function clearDiagnostics() { events.length = 0; }
