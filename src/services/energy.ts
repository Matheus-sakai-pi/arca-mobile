import { anonymousSupabase, requireSupabase, scopedSupabase } from '@/lib/supabase';
import { decodeEnergy, type EnergyState } from '@/lib/energy';
import { sessionStorage } from '@/lib/sessionStorage';
import { createGuestBatteryIdentity, isRejectedGuestBattery } from '@/lib/guestBattery';
import type { Database } from '@/types/backend';

type Args = Database['public']['Functions']['learning_battery']['Args'];
function check(error: { code?: string; message: string } | null, chest = false) {
  if (!error) return;
  if (
    chest &&
    (error.message.includes('battery_action_invalid') || error.code === 'PGRST202' || error.code === '42883')
  )
    throw new Error('As recompensas do baú ainda precisam ser ativadas no servidor. Seu baú não foi gasto.');
  if (error.message.includes('chest_locked'))
    throw new Error('Conclua metade das lições desta unidade para abrir o baú.');
  if (error.message.includes('chest_battery_full'))
    throw new Error('Sua bateria está cheia. O baú continua guardado para depois.');
  if (error.code === 'PGRST202' || error.code === '42883')
    throw new Error('A nova bateria ainda precisa ser ativada no servidor. Sua tentativa continua guardada.');
  if (error.message.includes('lesson_locked'))
    throw new Error('Conclua a lição anterior antes de continuar.');
  if (error.message === 'battery_session_required')
    throw new Error(
      'Abra esta lição novamente para recuperar sua tentativa no servidor. Suas respostas locais continuam guardadas.',
    );
  if (/answer_conflict|answer_order_invalid|attempt_conflict/.test(error.message))
    throw new Error(
      'A tentativa mudou em outro aparelho ou aba. Saia e retome para conferir a resposta registrada.',
    );
  if (chest) throw new Error('Não foi possível conferir o baú agora. Atualize e tente novamente.');
  throw new Error('Conecte-se para confirmar a energia e continuar. Sua resposta continua guardada.');
}
const backend = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const guestClient = anonymousSupabase;
const guestIdentity =
  guestClient && backend
    ? createGuestBatteryIdentity({
        backend,
        storage: sessionStorage,
        rpc: args => guestClient.rpc('learning_battery', args),
        check,
      })
    : null;
export function energyRepository(owner: string) {
  const client = owner === 'guest' ? anonymousSupabase : scopedSupabase(requireSupabase(), owner);
  return {
    async call(args: Args): Promise<EnergyState> {
      if (!client) throw new Error('Conecte-se para ativar sua bateria.');
      let token = owner === 'guest' ? await guestIdentity?.get() : undefined;
      let result = await client.rpc('learning_battery', { ...args, ...(token ? { p_guest: token } : {}) });
      // Recover only an explicitly rejected guest identity, never a network/answer failure.
      if (owner === 'guest' && token && guestIdentity && isRejectedGuestBattery(result.error)) {
        await guestIdentity.invalidate(token);
        token = await guestIdentity.get();
        result = await client.rpc('learning_battery', { ...args, p_guest: token });
      }
      const { data, error } = result;
      const isChest = args.p_action?.startsWith('chest_') ?? false;
      check(error, isChest);
      const state = decodeEnergy(data, owner);
      if (isChest && state.chest?.unitId !== args.p_lesson)
        throw new Error('Não foi possível confirmar o baú desta unidade.');
      return state;
    },
  };
}
