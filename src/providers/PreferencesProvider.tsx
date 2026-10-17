import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { accountStorage } from '@/lib/accountStorage';
import { defaultPreferences, parsePreferences, preferencesKey, type Preferences } from '@/lib/preferencesStore';
import { setRewardHapticsEnabled } from '@/lib/rewardHaptics';

const SOUND_KEY = '@arca/sound-effects-enabled';
const Context = createContext<(Preferences & { setSoundEnabled:(enabled:boolean)=>Promise<void>; updatePreferences:(values:Partial<Preferences>)=>Promise<void>; ready:boolean; error:string|null }) | null>(null);
export function PreferencesProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const scope = session?.user.id ?? 'guest';
  return <ScopedPreferences key={scope} scope={scope}>{children}</ScopedPreferences>;
}
function ScopedPreferences({children,scope}:PropsWithChildren<{scope:string}>) {
  const [preferences,setPreferences] = useState<Preferences>(defaultPreferences);
  const [ready,setReady] = useState(false);
  const [error,setError] = useState<string|null>(null);
  const current = useRef(preferences);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current=true;
    queue.current=(async()=>{
      try {
        const raw=await accountStorage.getItem(preferencesKey(scope));
        const value=raw ? parsePreferences(raw) : {...defaultPreferences,soundEnabled:await AsyncStorage.getItem(SOUND_KEY) !== 'false'};
        current.current=value;
        if(mounted.current) setPreferences(value);
      } catch { if(mounted.current) setError('Não foi possível ler suas preferências.'); }
      finally { if(mounted.current) setReady(true); }
    })();
    return()=>{mounted.current=false;};
  },[scope]);
  useEffect(()=>{setRewardHapticsEnabled(preferences.hapticsEnabled);},[preferences.hapticsEnabled]);
  const updatePreferences=useCallback((values:Partial<Preferences>)=>{
    const task=queue.current.then(async()=>{
      const value=parsePreferences(JSON.stringify({...current.current,...values}));
      await accountStorage.setItem(preferencesKey(scope),JSON.stringify(value));
      current.current=value;
      if(mounted.current) {setPreferences(value);setError(null);}
    });
    queue.current=task.catch(()=>undefined);
    return task;
  },[scope]);
  const setSoundEnabled=useCallback((soundEnabled:boolean)=>updatePreferences({soundEnabled}),[updatePreferences]);
  return <Context.Provider value={{...preferences,ready,error,setSoundEnabled,updatePreferences}}>{children}</Context.Provider>;
}
export function usePreferences() { const value=useContext(Context); if (!value) throw new Error('Preferências indisponíveis.'); return value; }
