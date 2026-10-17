import { useCallback, useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Bell, Clock3, X } from 'lucide-react-native';
import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { IconButton } from '@/components/common/IconButton';
import { Notice } from '@/components/common/Notice';
import { useAuth } from '@/hooks/useAuth';
import { useMotionPreference } from '@/hooks/useMotionPreference';
import { accountStorage } from '@/lib/accountStorage';
import { reminderPromptKey, shouldOfferReminder } from '@/lib/reminderPrompt';
import { loadReminder, remindersSupported } from '@/services/reminders';
import { colors } from '@/constants/theme';
import { resultMotion } from '@/constants/motion';

export function ReminderPrompt({completed}:{completed:readonly string[]}){
  const {session}=useAuth();const owner=session?.user.id??'guest';
  return <ScopedPrompt key={owner} owner={owner} completed={completed}/>;
}
function ScopedPrompt({owner,completed}:{owner:string;completed:readonly string[]}){
  const [visible,setVisible]=useState(false),[dismissed,setDismissed]=useState(false),[busy,setBusy]=useState(false);
  const active=useRef(false),locked=useRef(false),epoch=useRef(0);
  const reduced=useMotionPreference();
  const eligible=shouldOfferReminder(completed,dismissed,false);
  useFocusEffect(useCallback(()=>{
    active.current=true;epoch.current++;let current=true;let timer:ReturnType<typeof setTimeout>|undefined;
    if(eligible)void(async()=>{
      try{
        const [seen,reminder]=await Promise.all([accountStorage.getItem(reminderPromptKey(owner)),loadReminder()]);
        if(current&&eligible&&seen===null&&!reminder.enabled)timer=setTimeout(()=>{if(current)setVisible(true);},reduced ? 1000 : resultMotion.invitation);
      }catch{/* An optional invitation must never interrupt study when storage is unavailable. */}
    })();
    return()=>{current=false;active.current=false;epoch.current++;clearTimeout(timer);setVisible(false);};
  },[eligible,owner,reduced]));
  async function dismiss(configure:boolean){
    if(locked.current)return;const version=epoch.current;locked.current=true;setBusy(true);
    try{await accountStorage.setItem(reminderPromptKey(owner),'offered');}catch{/* Still allow declining if local storage fails. */}
    finally{locked.current=false;if(active.current&&version===epoch.current){setBusy(false);setVisible(false);setDismissed(true);if(configure)router.push('/study/reminders');}}
  }
  return <Modal visible={visible&&!dismissed} transparent animationType={reduced?'none':'fade'} onRequestClose={()=>void dismiss(false)}><ScrollView style={styles.overlay} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><View testID="study-reminder-prompt" accessibilityViewIsModal style={styles.dialog}>
    <View style={styles.heading}><View style={styles.icon}><Bell size={28} color={colors.tealInk}/></View><IconButton icon={X} label="Fechar convite de lembrete" disabled={busy} onPress={()=>void dismiss(false)}/></View>
    <AppText variant="label" color={colors.tealInk}>Um bom começo</AppText>
    <AppText accessibilityRole="header" variant="h2">Um horário para sua jornada?</AppText>
    <AppText color={colors.muted}>Você já concluiu suas três primeiras lições. Quer escolher um lembrete diário para continuar estudando no seu ritmo?</AppText>
    {!remindersSupported?<Notice message="A ativação dos lembretes está disponível no aplicativo Android e iOS."/>:null}
    <Button title="Escolher horário" icon={Clock3} loading={busy} onPress={()=>void dismiss(true)}/>
    <Button title="Agora não" variant="quiet" disabled={busy} onPress={()=>void dismiss(false)}/>
  </View></ScrollView></Modal>;
}
const styles=StyleSheet.create({overlay:{flex:1,backgroundColor:'rgba(34,33,42,0.45)'},content:{flexGrow:1,justifyContent:'center',alignItems:'center',padding:20},dialog:{width:'100%',maxWidth:400,padding:24,gap:14,borderRadius:8,backgroundColor:colors.surface},heading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},icon:{width:56,height:56,borderRadius:28,alignItems:'center',justifyContent:'center',backgroundColor:colors.tealSoft}});
