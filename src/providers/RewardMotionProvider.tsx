import { accountStorage } from '@/lib/accountStorage';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useLearning } from './LearningProvider';
import { journeyUnits } from '@/data/lessons';
import { createMotionLedger, recentCompletion, type NumberTransition } from '@/lib/motionEvents';
import { createAchievementStore, type AchievementId, type AchievementState } from '@/lib/achievements';

type ContextValue={ledger:ReturnType<typeof createMotionLedger>;coins:Record<string,string>;achievements:AchievementState|null;achievementError:string|null;dismissAchievement:(id:AchievementId)=>Promise<void>;retryAchievements:()=>void};
const Context=createContext<ContextValue|null>(null);
export function RewardMotionProvider({children}:PropsWithChildren) {
  const {session}=useAuth();
  const scope=session?.user.id ?? 'guest';
  return <ScopedRewardMotion key={scope} scope={scope}>{children}</ScopedRewardMotion>;
}
function ScopedRewardMotion({children,scope}:PropsWithChildren<{scope:string}>) {
  const {progress,profile,unit,loading,pending,offline}=useLearning();
  const [ledger]=useState(createMotionLedger);
  const [store]=useState(()=>createAchievementStore(accountStorage,scope));
  const previous=useRef<{completed:string[];attempt:string|undefined}|null>(null);
  const [coins,setCoins]=useState<Record<string,string>>({});
  const [achievements,setAchievements]=useState<AchievementState|null>(null);
  const [achievementError,setError]=useState<string|null>(null);
  const [retry,setRetry]=useState(0);
  const initialized=useRef(false);
  const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  useEffect(()=>{
    if(loading || !progress) return;
    if(!previous.current) {
      ledger.seed('xp',progress.xp);
      ledger.seed('streak',profile?.current_streak ?? 0);
      journeyUnits(unit).forEach(item=>ledger.seed(`unit:${item.id}`,item.lessons.filter(lesson=>progress.completedLessonIds.includes(lesson.id)).length/item.lessons.length*100));
      previous.current={completed:progress.completedLessonIds,attempt:progress.lastResult?.attemptId};
      return;
    }
    const id=recentCompletion(previous.current.completed,progress.completedLessonIds,progress.lastResult?.lessonId);
    if(id && previous.current.attempt !== progress.lastResult?.attemptId) setCoins(old=>({...old,[id]:progress.lastResult!.attemptId}));
    previous.current={completed:progress.completedLessonIds,attempt:progress.lastResult?.attemptId};
  },[loading,progress,profile,ledger,unit]);
  useEffect(()=>{
    // Account milestones wait for a confirmed snapshot, never provisional offline XP.
    if(loading || !progress || (scope !== 'guest' && (pending > 0 || offline))) return;
    let active=true;
    void (async()=>{
      try {
        await store.load();
        const next=await store.evaluate({progress,units:journeyUnits(unit),longestStreak:profile?.longest_streak ?? 0},initialized.current);
        initialized.current=true;
        if(active) {setAchievements(next);setError(null);}
      } catch {if(active) setError('Não foi possível ler ou salvar suas conquistas. Seu progresso permanece guardado.');}
    })();
    return()=>{active=false;};
  },[loading,progress,profile,unit,pending,offline,scope,store,retry]);
  const dismissAchievement=useCallback(async(id:AchievementId)=>{
    try { const next=await store.acknowledge(id);if(mounted.current) {setAchievements(next);setError(null);} }
    catch {if(mounted.current) setError('Não foi possível salvar a confirmação. Tente novamente.');}
  },[store]);
  const retryAchievements=useCallback(()=>setRetry(value=>value+1),[]);
  return <Context.Provider value={{ledger,coins,achievements,achievementError,dismissAchievement,retryAchievements}}>{children}</Context.Provider>;
}
export function useRewardMotion() {const value=useContext(Context);if(!value) throw new Error('RewardMotionProvider ausente.');return value;}
export function useCounterMotion(key:string,value:number,entrance=false,metric?:string) {
  const {ledger}=useRewardMotion();
  const [transition,setTransition]=useState<NumberTransition>(()=>({from:ledger.peek(key) ?? (entrance ? 0 : metric ? ledger.baseline(metric) ?? value : value),to:value,event:0}));
  useFocusEffect(useCallback(()=>{
    setTransition(ledger.number(key,value,entrance,metric ? ledger.baseline(metric) ?? value : value));
  },[ledger,key,value,entrance,metric]));
  return transition;
}
export function useCompletionMotion(id:string,enabled=true) {
  const {ledger,coins}=useRewardMotion();
  const event=coins[id];
  const [trigger,setTrigger]=useState('');
  useFocusEffect(useCallback(()=>{if(enabled && event && ledger.claim(`coin:${id}`,event)) setTrigger(event);},[ledger,event,id,enabled]));
  return trigger;
}
