import { requireSupabase, scopedSupabase } from '@/lib/supabase';
import { decodePhotoStatus, isPhotoId, PHOTO_CONFIG, photoError } from '@/lib/profilePhoto';

const api = (owner: string) => scopedSupabase(requireSupabase(), owner);
export async function syncProfilePhoto(
  owner: string,
  action: 'status' | 'cancel' | 'remove' = 'status',
  id?: string,
) {
  const { data, error } = await api(owner).rpc('learning_profile_photo', {
    p_action: action,
    ...(id ? { p_id: id } : {}),
  });
  if (error) throw new Error(photoError(error.message));
  return decodePhotoStatus(data, owner);
}
export async function signedPhoto(
  owner: string,
  id: string,
  preview = false,
): Promise<{ uri: string; userId: string } | null> {
  if (!isPhotoId(id)) return null;
  const client = api(owner);
  const { data: path, error } = await client.rpc('learning_profile_photo_view', {
    p_id: id,
    p_preview: preview,
  });
  if (error) throw new Error(photoError(error.message));
  if (path === null) return null;
  if (
    typeof path !== 'string' ||
    path.split('/').length !== 2 ||
    !isPhotoId(path.split('/')[0]) ||
    path.split('/')[1] !== `${id}.jpg`
  )
    throw new Error('Foto indisponível.');
  const { data, error: signingError } = await client.storage
    .from('profile-photos')
    .createSignedUrl(path, PHOTO_CONFIG.signedSeconds);
  if (signingError || !data) throw new Error('Foto indisponível.');
  const url = new URL(data.signedUrl),
    expected = new URL(process.env.EXPO_PUBLIC_SUPABASE_URL!);
  if (url.origin !== expected.origin || !url.pathname.endsWith(`/profile-photos/${path}`))
    throw new Error('Foto indisponível.');
  return { uri: url.toString(), userId: path.split('/')[0]! };
}
export async function uploadProfilePhoto(owner: string, id: string, image: string) {
  const { data, error } = await api(owner).functions.invoke('profile-photo', {
    body: { id, image, consent: PHOTO_CONFIG.termsVersion },
  });
  if (error) {
    let code = '';
    if ('context' in error && error.context instanceof Response) {
      try {
        code = (await error.context.json()).error ?? '';
      } catch {
        /* Generic connection message below. */
      }
    }
    throw new Error(photoError(code));
  }
  if (data?.owner !== owner || data.id !== id || !['pending', 'approved'].includes(data.state))
    throw new Error('Não foi possível confirmar o envio. Atualize o status.');
}
export async function photoSafety(owner: string, id: string, action: 'report' | 'block', reason = 'other') {
  const { error } = await api(owner).rpc('learning_photo_safety', {
    p_id: id,
    p_action: action,
    p_reason: reason,
  });
  if (error) throw new Error(photoError(error.message));
}
export async function photoBlocks(owner: string, unblock?: string): Promise<{ id: string; name: string }[]> {
  const { data, error } = await api(owner).rpc('learning_photo_blocks', unblock ? { p_user: unblock } : {});
  if (
    error ||
    !Array.isArray(data) ||
    data.some(
      item =>
        !item ||
        typeof item !== 'object' ||
        !('id' in item) ||
        !isPhotoId(item.id) ||
        !('name' in item) ||
        typeof item.name !== 'string',
    )
  )
    throw new Error('Não foi possível carregar os bloqueios.');
  return data as { id: string; name: string }[];
}
