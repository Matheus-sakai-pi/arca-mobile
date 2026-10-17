export const reportReasons = { answer: 'Resposta incorreta', explanation: 'Explicação confusa', text: 'Erro de texto', technical: 'Problema técnico', other: 'Outro motivo' } as const;
export type ReportReason = keyof typeof reportReasons;
export function decodeReportReceipt(value: unknown, owner: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !('id' in value) || typeof value.id !== 'string'
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.id) || !('reporterId' in value) || value.reporterId !== owner
    || !('received' in value) || value.received !== true || !('duplicate' in value) || typeof value.duplicate !== 'boolean')
    throw new Error('Não foi possível confirmar o recebimento. Tente novamente.');
  return { id: value.id, duplicate: value.duplicate };
}
export function reportError(error: { code?: string; message: string }) {
  if (/auth_required/.test(error.message)) return 'Entre na sua conta para enviar um relato.';
  if (/report_limit/.test(error.message)) return 'Você atingiu o limite de relatos de hoje. Tente novamente amanhã.';
  if (/report_question_missing/.test(error.message)) return 'Esta pergunta foi atualizada. Reabra a lição antes de relatar.';
  if (error.code === 'PGRST202' || error.code === '42883') return 'Este recurso ainda precisa ser ativado no servidor.';
  return 'Não foi possível concluir. Confira a conexão e tente novamente.';
}
