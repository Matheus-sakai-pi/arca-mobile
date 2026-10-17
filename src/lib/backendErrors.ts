export class BackendRejectedError extends Error {}
export function learningErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('guest_already_imported')) return 'Este progresso de visitante já foi salvo em outra conta. Os dados locais continuam guardados.';
  if (message.includes('lesson_locked')) return 'Conclua a lição anterior antes de continuar.';
  if (message.includes('answer_invalid') || message.includes('answer_incomplete') || message.includes('attempt_conflict')) return 'Esta tentativa não foi aceita. Abra a lição novamente e tente outra vez.';
  if (message.includes('guest_invalid')) return 'Não foi possível validar o progresso de visitante. Seus dados locais não foram apagados.';
  if (message.includes('profiles_username_key')) return 'Este nome de usuário já está em uso. Escolha outro.';
  return 'Não foi possível sincronizar agora. Seu progresso salvo no aparelho continua guardado.';
}
