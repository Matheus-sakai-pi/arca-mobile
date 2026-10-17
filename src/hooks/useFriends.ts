import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { AppState } from 'react-native';
import { useAuth } from './useAuth';
import { friendsRepository } from '@/services/friends';
import { friendQuery } from '@/lib/friends';
import type { FriendAction, Friends, Person } from '@/types/friends';

export function useFriends() {
  const {session} = useAuth();
  const owner = session?.user.id ?? null;
  const [state,setState] = useState<{owner:string;data:Friends}|null>(null);
  const [searchState,setSearchState] = useState<{owner:string;query:string;people:Person[]}|null>(null);
  const [error,setError] = useState<string|null>(null);
  const [searchError,setSearchError] = useState<string|null>(null);
  const [loading,setLoading] = useState(false);
  const [searching,setSearching] = useState(false);
  const [busy,setBusy] = useState(false);
  const epoch = useRef(0), reads = useRef(0), searches = useRef(0);
  const controllers = useRef(new Set<AbortController>());
  const acting = useRef(false);
  const controller = () => {const next=new AbortController();controllers.current.add(next);return next;};
  const refresh = useCallback(async () => {
    if (!owner || acting.current) return;
    const version=epoch.current, read=++reads.current, request=controller();
    setLoading(true);setError(null);
    try {
      const data=await friendsRepository(owner).load(request.signal);
      if (version===epoch.current && read===reads.current) setState({owner,data});
    } catch (cause) {
      if (version===epoch.current && read===reads.current) setError(cause instanceof Error ? cause.message : 'Não foi possível buscar os amigos.');
    } finally {
      controllers.current.delete(request);
      if (version===epoch.current && read===reads.current) setLoading(false);
    }
  },[owner]);
  useFocusEffect(useCallback(() => {
    epoch.current++;acting.current=false;setBusy(false);setError(null);setSearchError(null);setSearching(false);setSearchState(null);
    void refresh();
    const listener=AppState.addEventListener('change',value=>{if(value==='active') void refresh();});
    const pending=controllers.current;
    return () => {epoch.current++;listener.remove();for(const request of pending) request.abort();pending.clear();};
  },[refresh]));
  async function search(value: string) {
    if (!owner || acting.current) return;
    const query=friendQuery(value);
    if (!query) {setSearchError('Use pelo menos 3 letras, números ou _ do usuário.');return;}
    const version=epoch.current, read=++searches.current, request=controller();
    setSearching(true);setSearchError(null);setSearchState(null);
    try {
      const people=await friendsRepository(owner).search(query,request.signal);
      if(version===epoch.current && read===searches.current) setSearchState({owner,query,people});
    } catch(cause) {
      if(version===epoch.current && read===searches.current) setSearchError(cause instanceof Error ? cause.message : 'Não foi possível buscar.');
    } finally {
      controllers.current.delete(request);
      if(version===epoch.current && read===searches.current) setSearching(false);
    }
  }
  async function act(person: string, action: FriendAction) {
    if (!owner || acting.current) return;
    const version=epoch.current, request=controller();
    acting.current=true;reads.current++;searches.current++;setLoading(false);setSearching(false);setBusy(true);setError(null);
    try {
      const data=await friendsRepository(owner).act(person,action,request.signal);
      if(version===epoch.current) {setState({owner,data});setSearchState(null);}
    } catch(cause) {
      if(version===epoch.current) setError(cause instanceof Error ? cause.message : 'Não foi possível atualizar a amizade.');
    } finally {
      controllers.current.delete(request);
      if(version===epoch.current) {acting.current=false;setBusy(false);}
    }
  }
  return {data:state?.owner===owner ? state.data : null,results:searchState?.owner===owner ? searchState : null,error,searchError,loading,searching,busy,refresh,search,act};
}
