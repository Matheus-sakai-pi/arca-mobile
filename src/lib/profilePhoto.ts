export const PHOTO_CONFIG = Object.freeze({
  bytes: 393216,
  dimension: 512,
  termsVersion: 1,
  signedSeconds: 60,
});
export const photoStates = [
  'uploading',
  'pending',
  'approved',
  'rejected',
  'removed',
  'cancelled',
  'superseded',
] as const;
export type PhotoStatus = {
  owner: string;
  vip: boolean;
  restricted: boolean;
  latest: { id: string; state: (typeof photoStates)[number]; reason: string; updatedAt: string } | null;
};
export const isPhotoId = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
export function photoAvatarId(key: unknown): string | null {
  return typeof key === 'string' && key.startsWith('photo:') && isPhotoId(key.slice(6)) ? key.slice(6) : null;
}
export function decodePhotoStatus(value: unknown, owner: string): PhotoStatus {
  const v = value as PhotoStatus | null;
  if (
    !v ||
    v.owner !== owner ||
    typeof v.vip !== 'boolean' ||
    typeof v.restricted !== 'boolean' ||
    !(
      v.latest === null ||
      (isPhotoId(v.latest?.id) &&
        photoStates.includes(v.latest.state) &&
        typeof v.latest.reason === 'string' &&
        v.latest.reason.length <= 300 &&
        Number.isFinite(Date.parse(v.latest.updatedAt)))
    )
  ) {
    throw new Error('Não foi possível conferir sua foto de perfil.');
  }
  return v;
}
export function photoError(code: string): string {
  if (code.includes('vip_required')) return 'Uma conta VIP ativa é necessária para enviar uma foto.';
  if (code.includes('photo_restricted'))
    return 'Novos envios de fotos estão suspensos para esta conta. Fale com o suporte.';
  if (code.includes('photo_pending'))
    return 'Você já tem uma foto em análise. Atualize o status ou cancele o envio anterior.';
  if (code.includes('photo_limit')) return 'Limite de envios atingido. Tente novamente depois de 24 horas.';
  if (code.includes('photo_size')) return 'A foto ficou muito grande. Escolha outra imagem.';
  if (code.includes('photo_invalid')) return 'Não foi possível preparar essa imagem. Escolha outra foto.';
  if (code.includes('photo_conflict'))
    return 'O status dessa foto mudou. Atualize antes de tentar novamente.';
  return 'Não foi possível concluir. Confira a conexão e atualize o status antes de tentar novamente.';
}
