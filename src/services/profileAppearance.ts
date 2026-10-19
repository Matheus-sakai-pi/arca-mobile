import { requireSupabase, scopedSupabase } from '@/lib/supabase';
import { decodeProfileAppearance, type ProfileAppearance } from '@/lib/profileAppearance';

export async function syncProfileAppearance(owner: string, value?: ProfileAppearance) {
  const { data, error } = await scopedSupabase(requireSupabase(), owner).rpc(
    'learning_profile_appearance',
    value ? { p_frame: value.frame, p_background: value.background, p_badge: value.showBadge } : {},
  );
  if (error)
    throw new Error(
      error.message.includes('vip_required')
        ? 'Uma assinatura VIP ativa é necessária para salvar este estilo.'
        : 'Não foi possível salvar ou carregar a personalização. Confira a conexão e tente novamente.',
    );
  return decodeProfileAppearance(data, owner);
}
