import { privacyContact } from '../constants/privacy.ts';
import type { DiagnosticEvent } from './diagnostics.ts';
export function supportRequestUrl(version: string, context?: { lessonId: string; questionId: string }, diagnostics: readonly DiagnosticEvent[] = []): string {
  const subject = context ? 'Arca - Reportar pergunta' : 'Arca - Suporte';
  const body = [
    'Olá, gostaria de ajuda com o Arca.', '', `Versão: ${version}`,
    ...(context ? [`Lição: ${context.lessonId}`, `Pergunta: ${context.questionId}`] : []),
    '', 'Descrição do problema:', '', '',
    ...(diagnostics.length ? ['Diagnóstico técnico (sem e-mail, senha ou respostas):', ...diagnostics.slice(-10).map(event => `${event.at} ${event.code}${event.durationMs === undefined ? '' : ` ${event.durationMs}ms`}`)] : []),
  ].join('\n');
  return `mailto:${privacyContact.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
