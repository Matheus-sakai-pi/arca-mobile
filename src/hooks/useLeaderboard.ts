import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from './useAuth';
import { useLearning } from '@/providers/LearningProvider';
import { scopedSupabase, supabase } from '@/lib/supabase';
import { decodeLeaderboard } from '@/lib/leaderboard';
import type { Leaderboard, RankingScope } from '@/types/leaderboard';

export function useLeaderboard(scope: RankingScope = 'total') {
  const {session,loading:authLoading} = useAuth();
  const {profile} = useLearning();
  const userId = session?.user.id ?? null;
  const publicVersion = profile ? `${profile.avatar_key}:${profile.display_name}:${profile.xp_total}` : '';
  const [result,setResult] = useState<{owner:string|null;scope:RankingScope;publicVersion:string;data:Leaderboard}|null>(null);
  const [failure,setFailure] = useState<{owner:string|null;scope:RankingScope;message:string}|null>(null);
  const [refreshing,setRefreshing] = useState(false);
  const revision = useRef(0);
  const request = useRef<AbortController|null>(null);
  const refresh = useCallback(async()=>{
    if (!supabase || authLoading || (scope === 'friends' && !userId)) {setRefreshing(false);return;}
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const version = ++revision.current;
    setRefreshing(true); setFailure(null);
    try {
      const client = userId ? scopedSupabase(supabase,userId) : supabase;
      const {data,error} = await (scope === 'total' ? client.rpc('learning_leaderboard') : client.rpc('learning_leaderboard_scope',{p_scope:scope})).abortSignal(controller.signal);
      if (error) throw new Error(error.code === 'PGRST202' || error.code === '42883'
        ? 'O ranking precisa ser habilitado no servidor. Tente novamente mais tarde.'
        : 'Não foi possível atualizar o ranking. Confira sua conexão e tente novamente.');
      const decoded = decodeLeaderboard(data,userId,scope);
      if (version === revision.current) setResult({owner:userId,scope,publicVersion,data:decoded});
    } catch(error) {
      if (version === revision.current && !controller.signal.aborted) setFailure({owner:userId,scope,message:error instanceof Error ? error.message : 'Não foi possível carregar o ranking.'});
    } finally { if (version === revision.current) setRefreshing(false); }
  },[userId,scope,authLoading,publicVersion]);
  useFocusEffect(useCallback(()=>{
    void refresh();
    const listener = AppState.addEventListener('change',state=>{if (state === 'active') void refresh();});
    return ()=>{listener.remove();revision.current++;request.current?.abort();};
  },[refresh]));
  const data = result?.owner === userId && result.scope === scope ? result.data : null;
  const visible = data && profile?.id === userId ? {
    ...data,top:data.top.map(row=>row.id === userId ? {...row,avatar_key:profile.avatar_key,display_name:profile.display_name} : row),
    current:data.current ? {...data.current,avatar_key:profile.avatar_key,display_name:profile.display_name} : null,
  } : data;
  const error=failure?.owner === userId && failure.scope === scope ? failure.message : null;
  return {data:visible,error,loading:authLoading || (!!supabase && !data && !error && (scope !== 'friends' || !!userId)),refreshing,refresh};
}
