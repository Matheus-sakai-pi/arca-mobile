import { requireSupabase, scopedSupabase } from '@/lib/supabase';
import { challengeError, decodeChallengePlay, decodeChallenges } from '@/lib/challenges';
import type { Json } from '@/types/backend';
import type { LessonAnswers } from '@/types/learning';
export function challengesRepository(owner:string){
  const client=scopedSupabase(requireSupabase(),owner);
  const check=(error:{code?:string;message:string}|null)=>{if(error)throw new Error(challengeError(error));};
  return {
    async load(signal:AbortSignal){const {data,error}=await client.rpc('learning_challenges').abortSignal(signal);check(error);return decodeChallenges(data,owner);},
    async create(friend:string,key:string,signal:AbortSignal){const {data,error}=await client.rpc('learning_challenge_create_ten',{p_friend:friend,p_key:key}).abortSignal(signal);check(error);if(typeof data!=='string'||!/^[-a-f0-9]{36}$/i.test(data))throw new Error('Não foi possível confirmar o convite.');return data;},
    async act(id:string,action:'accept'|'decline'|'cancel',signal:AbortSignal){const {data,error}=await client.rpc('learning_challenge_action',{p_id:id,p_action:action}).abortSignal(signal);check(error);return decodeChallenges(data,owner);},
    async play(id:string,signal:AbortSignal){const {data,error}=await client.rpc('learning_challenge_play',{p_id:id}).abortSignal(signal);check(error);return decodeChallengePlay(data,owner,id);},
    async submit(id:string,answers:LessonAnswers,signal:AbortSignal){const {data,error}=await client.rpc('learning_challenge_submit',{p_id:id,p_answers:answers as Json}).abortSignal(signal);check(error);return decodeChallenges(data,owner);},
  };
}
