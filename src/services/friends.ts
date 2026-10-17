import { scopedSupabase, requireSupabase } from '@/lib/supabase';
import { decodeFriends, decodePeople, friendQuery, socialError } from '@/lib/friends';
import type { FriendAction } from '@/types/friends';

export function friendsRepository(owner: string) {
  const client = scopedSupabase(requireSupabase(),owner);
  return {
    async load(signal: AbortSignal) {
      const {data,error} = await client.rpc('learning_friends').abortSignal(signal);
      if (error) throw new Error(socialError(error));
      return decodeFriends(data,owner);
    },
    async search(value: string, signal: AbortSignal) {
      const query = friendQuery(value);
      if (!query) throw new Error('Digite pelo menos 3 letras, números ou _ do nome de usuário.');
      const {data,error} = await client.rpc('search_learning_people',{p_query:query}).abortSignal(signal);
      if (error) throw new Error(socialError(error));
      return decodePeople(data,owner);
    },
    async act(person: string, action: FriendAction, signal: AbortSignal) {
      const {data,error} = await client.rpc('learning_friend_action',{p_person:person,p_action:action}).abortSignal(signal);
      if (error) throw new Error(socialError(error));
      return decodeFriends(data,owner);
    },
  };
}
