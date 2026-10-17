import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import { initialUnit } from '@/data/lessons';
import { useAuth } from '@/hooks/useAuth';
import { createAccountLearningStore, guestSource, type AccountState } from '@/lib/accountLearningStore';
import { learningErrorMessage } from '@/lib/backendErrors';
import { createLearningStore, parseProgress, PROGRESS_KEY } from '@/lib/learningProgress';
import { supabase } from '@/lib/supabase';
import { accountStorage } from '@/lib/accountStorage';
import { createLearningRepository } from '@/services/learning';
import type { LearningProgress, Lesson, LessonAnswers, LessonResult, Unit } from '@/types/learning';
import type { Profile } from '@/types/profile';
import { GuestProgressImportDialog } from '@/components/learning/GuestProgressImportDialog';
import { shouldShowGuestImport } from '@/lib/guestImportPolicy';

type Identity = Pick<Profile,'display_name'|'username'|'avatar_key'>;
type LearningContextValue = {
  unit: Unit; progress: LearningProgress | null; profile: Profile | null;
  loading: boolean; error: string | null; notice: string | null;
  offline: boolean; pending: number; rejected:number; syncing: boolean; importAvailable: boolean;
  activeLessonId: string | null; startLesson: (id: string) => void; endLesson:(id:string)=>void; retry: () => void;
  sync: () => Promise<void>; importGuest: () => Promise<void>; updateProfile: (identity:Identity) => Promise<void>;
  updateAvatar: (key:string) => Promise<void>;
  requestGuestImport: (afterSignIn?:boolean) => void;
  finishLesson: (lesson: Lesson, answers: LessonAnswers, attemptId: string) => Promise<LessonResult>;
};
type ViewState = { scope:string; progress:LearningProgress; account:AccountState|null; unit:Unit };
type AccountStore = ReturnType<typeof createAccountLearningStore>;
type GuestStore = ReturnType<typeof createLearningStore>;
const LearningContext = createContext<LearningContextValue | null>(null);
export function LearningProvider({ children }: PropsWithChildren) {
  const {session,loading:authLoading} = useAuth();
  const scope = session?.user.id ?? 'guest';
  const [importIntent,setImportIntent] = useState<'preview'|'account'|null>(null);
  const requestGuestImport = useCallback((afterSignIn=false)=>setImportIntent(afterSignIn ? 'account' : 'preview'),[]);
  const dismissImport = useCallback(()=>setImportIntent(null),[]);
  return <ScopedLearningProvider key={scope} scope={scope} authLoading={authLoading} importIntent={importIntent} requestGuestImport={requestGuestImport} dismissImport={dismissImport}>{children}</ScopedLearningProvider>;
}
function ScopedLearningProvider({children,scope,authLoading,importIntent,requestGuestImport,dismissImport}:PropsWithChildren<{scope:string;authLoading:boolean;importIntent:'preview'|'account'|null;requestGuestImport:(afterSignIn?:boolean)=>void;dismissImport:()=>void}>) {
  const generation = useRef(0);
  const current = useRef<{scope:string;account:AccountStore|null;guest:GuestStore|null}|null>(null);
  const [view,setView] = useState<ViewState|null>(null);
  const [failure,setFailure] = useState<{scope:string;message:string}|null>(null);
  const [notice,setNotice] = useState<string|null>(null);
  const [syncing,setSyncing] = useState(false);
  const [activeLessonId,setActiveLesson] = useState<string|null>(null);
  const [guestProgress,setGuestProgress] = useState<LearningProgress|null>(null);
  const [revision,setRevision] = useState(0);
  const apply = useCallback((owner:string,next:AccountState) => {
    if (scope === owner) setView({scope:owner,progress:next.progress,account:next,unit:next.unit});
  },[scope]);
  useEffect(() => {
    if (authLoading) return;
    const version = ++generation.current;
    const valid = () => generation.current === version;
    const account = scope !== 'guest' && supabase ? createAccountLearningStore(accountStorage,scope,createLearningRepository(supabase,scope)) : null;
    const guest = account ? null : createLearningStore(AsyncStorage);
    current.current = {scope,account,guest};
    void (async()=>{
      try {
        if (account) {
          const next = await account.load();
          if (valid()) apply(scope,next);
          try {
            const legacy = parseProgress(await AsyncStorage.getItem(PROGRESS_KEY));
            if (valid()) setGuestProgress(legacy);
          } catch { /* Keep malformed guest storage untouched; never show an automatic guest banner. */ }
        } else {
          const progress = await guest!.load();
          if (valid()) setView({scope,progress,account:null,unit:initialUnit});
        }
      } catch (error) {
        if (valid()) setFailure({scope,message:account ? learningErrorMessage(error) : 'Não foi possível ler seu progresso. Tente novamente. Seus dados não foram apagados.'});
      }
    })();
    return () => { generation.current=version+1; };
  },[scope,authLoading,revision,apply]);
  const retry = useCallback(()=>{setView(null);setFailure(null);setNotice(null);setActiveLesson(null);setSyncing(false);setGuestProgress(null);setRevision(value=>value+1);},[]);
  const sync = useCallback(async()=>{
    const owner = current.current;
    if (!owner?.account || owner.scope !== scope) return;
    const version = generation.current;
    setSyncing(true);
    try { const next = await owner.account.sync(); if (version === generation.current) { apply(owner.scope,next); setNotice(null); } }
    catch(error) { if (version === generation.current) setNotice(learningErrorMessage(error)); }
    finally { if (version === generation.current) setSyncing(false); }
  },[apply,scope]);
  const hasAccount=!!view?.account;
  const viewScope=view?.scope;
  useEffect(()=>{
    if (!hasAccount || viewScope !== scope || activeLessonId) return;
    let busy = false;
    const refresh = async()=>{ if (busy) return; busy=true; try { await sync(); } finally { busy=false; } };
    const timer = setInterval(()=>void refresh(),30000);
    const listener = AppState.addEventListener('change',state=>{ if (state === 'active') void refresh(); });
    return ()=>{ clearInterval(timer); listener.remove(); };
  },[hasAccount,viewScope,scope,activeLessonId,sync]);
  const startLesson = useCallback((id:string)=>{
    setActiveLesson(id);
  },[]);
  const endLesson=useCallback((id:string)=>setActiveLesson(currentId=>currentId === id ? null : currentId),[]);
  const finishLesson = useCallback(async(lesson:Lesson,answers:LessonAnswers,attemptId:string)=>{
    const owner = current.current;
    const version = generation.current;
    if (!owner || owner.scope !== scope) throw new Error('Sua conta mudou. Abra a lição novamente.');
    try {
      let result:LessonResult;
      if (owner.account) {
        const next = await owner.account.complete(lesson,answers,attemptId);
        result = next.result;
        if (version === generation.current) apply(owner.scope,{...next.state,progress:{...next.state.progress,lastResult:result}});
      } else {
        const next = await owner.guest!.complete(lesson,answers,attemptId);
        if (!next.lastResult) throw new Error('Não foi possível salvar o resultado.');
        result=next.lastResult;
        if (version === generation.current) setView({scope:owner.scope,progress:next,account:null,unit:initialUnit});
      }
      if (version !== generation.current || owner.scope !== scope) throw new Error('Sua conta mudou. Seu resultado ficou guardado na conta original.');
      setActiveLesson(null);
      return result;
    } catch(error) {
      if (version === generation.current && owner.account) apply(owner.scope,owner.account.getState());
      throw new Error(learningErrorMessage(error));
    }
  },[apply,scope]);
  const importGuest = useCallback(async()=>{
    const owner=current.current, version=generation.current;
    if (!owner?.account || owner.scope !== scope || !guestProgress?.completedLessonIds.length) throw new Error('Este progresso não está disponível para importar agora.');
    setSyncing(true); setNotice(null);
    try {
      const source=await guestSource(AsyncStorage);
      const next=await owner.account.importGuest(source,guestProgress);
      if (version === generation.current) { apply(owner.scope,next); setNotice('Seu progresso de visitante foi salvo na conta.'); }
    } catch(error) { throw new Error(learningErrorMessage(error)); }
    finally { if (version === generation.current) setSyncing(false); }
  },[guestProgress,apply,scope]);
  const updateProfile = useCallback(async(identity:Identity)=>{
    const owner=current.current,version=generation.current;
    if (!owner?.account || owner.scope !== scope) throw new Error('Entre na sua conta para editar o perfil.');
    const next=await owner.account.updateProfile(identity);
    if (version === generation.current && scope === owner.scope) apply(owner.scope,next);
  },[apply,scope]);
  const visible=view?.scope === scope ? view : null;
  const updateAvatar = useCallback(async(key:string)=>{
    const owner=current.current,version=generation.current;
    if (!owner?.account || owner.scope !== scope) throw new Error('Entre na sua conta para escolher um avatar.');
    const next=await owner.account.updateAvatar(key);
    if (version === generation.current && scope === owner.scope) apply(owner.scope,next);
  },[apply,scope]);
  const account=visible?.account;
  const localProgress = account ? guestProgress : visible?.progress;
  const importAvailable = !!account && !account.guestImported && !!guestProgress?.completedLessonIds.length;
  const showImport = shouldShowGuestImport(importIntent,!!account,account?.guestImported ?? false,localProgress?.completedLessonIds.length ?? 0);
  const error=failure?.scope === scope ? failure.message : null;
  return <LearningContext.Provider value={{
    unit:visible?.unit ?? initialUnit,progress:visible?.progress ?? null,profile:account?.profile ?? null,
    loading:authLoading || (!visible && !error),error,notice,offline:account?.offline ?? false,
    pending:account?.pending ?? 0,rejected:account?.rejected ?? 0,syncing,importAvailable,
    activeLessonId,startLesson,endLesson,retry,sync,importGuest,requestGuestImport,updateProfile,updateAvatar,finishLesson,
  }}>{children}{showImport && localProgress ? <GuestProgressImportDialog xp={localProgress.xp} lessons={localProgress.completedLessonIds.length} hasAccount={!!account} unavailable={!!account && (account.offline || account.pending > 0)} loading={syncing} onImport={importGuest} onDismiss={dismissImport} onAuthenticate={()=>requestGuestImport(true)} /> : null}</LearningContext.Provider>;
}
export function useLearning() {
  const context = useContext(LearningContext);
  if (!context) throw new Error('useLearning precisa de LearningProvider.');
  return context;
}
