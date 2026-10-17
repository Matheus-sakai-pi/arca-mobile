import { useCallback, useRef, useState } from 'react';
import { AppState, Linking, StyleSheet, Switch, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ArrowLeft, Bell, Check, Settings } from 'lucide-react-native';
import { Screen } from '@/components/common/Screen';
import { AppText } from '@/components/common/AppText';
import { IconButton } from '@/components/common/IconButton';
import { Button } from '@/components/common/Button';
import { Notice } from '@/components/common/Notice';
import { PushSettings } from '@/components/learning/PushSettings';
import { defaultReminder, loadReminder, remindersSupported, saveReminder } from '@/services/reminders';
import { colors, fonts } from '@/constants/theme';

export default function Reminders(){
  const [saved,setSaved]=useState(defaultReminder),[enabled,setEnabled]=useState(false);
  const [hour,setHour]=useState('19'),[minute,setMinute]=useState('00');
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[success,setSuccess]=useState(false);
  const active=useRef(false),locked=useRef(false);
  useFocusEffect(useCallback(()=>{
    active.current=true;
    function refresh(){if(locked.current)return;setLoading(true);void loadReminder().then(value=>{if(active.current){setSaved(value);setEnabled(value.enabled);setHour(String(value.hour).padStart(2,'0'));setMinute(String(value.minute).padStart(2,'0'));setError(null);setSuccess(false);}}).catch(()=>{if(active.current)setError('Não foi possível ler o lembrete deste aparelho.');}).finally(()=>{if(active.current)setLoading(false);});}
    refresh();const listener=AppState.addEventListener('change',state=>{if(state==='active')refresh();});
    return()=>{active.current=false;listener.remove();};
  },[]));
  const valid=/^\d{1,2}$/.test(hour)&&Number(hour)<24&&/^\d{1,2}$/.test(minute)&&Number(minute)<60;
  const dirty=enabled!==saved.enabled||(enabled&&(Number(hour)!==saved.hour||Number(minute)!==saved.minute));
  async function save(){
    if(locked.current||(enabled&&!valid))return;locked.current=true;setBusy(true);setError(null);setSuccess(false);
    try{const value=await saveReminder({enabled,hour:valid?Number(hour):saved.hour,minute:valid?Number(minute):saved.minute});if(active.current){setSaved(value);setSuccess(true);}}
    catch(cause){if(active.current)setError(cause instanceof Error?cause.message:'Não foi possível guardar o lembrete.');}
    finally{locked.current=false;if(active.current)setBusy(false);}
  }
  return <Screen keyboard><View style={styles.heading}><IconButton icon={ArrowLeft} label="Voltar" disabled={busy} onPress={()=>router.canGoBack()?router.back():router.replace('/(tabs)/profile')}/><AppText variant="h2" style={styles.grow}>Lembrete de estudo</AppText></View>
    <View style={styles.row}><Bell color={colors.tealInk} size={24}/><AppText style={styles.grow}>Lembrar todos os dias</AppText><Switch accessibilityLabel="Lembrete diário" value={enabled} disabled={loading||busy||!remindersSupported} onValueChange={value=>{setEnabled(value);setSuccess(false);}} trackColor={{false:colors.track,true:colors.primary}}/></View>
    <View style={styles.time}><View><AppText variant="small" color={colors.muted}>Hora</AppText><TextInput accessibilityLabel="Hora do lembrete" value={hour} onChangeText={value=>{setHour(value.replace(/\D/g,''));setSuccess(false);}} keyboardType="number-pad" maxLength={2} editable={enabled&&!busy&&remindersSupported} style={styles.input}/></View><AppText variant="h2">:</AppText><View><AppText variant="small" color={colors.muted}>Minuto</AppText><TextInput accessibilityLabel="Minuto do lembrete" value={minute} onChangeText={value=>{setMinute(value.replace(/\D/g,''));setSuccess(false);}} keyboardType="number-pad" maxLength={2} editable={enabled&&!busy&&remindersSupported} style={styles.input}/></View></View>
    <AppText color={colors.muted}>Todos os dias, no horário local deste aparelho.</AppText>
    {!remindersSupported?<Notice message="Disponível no aplicativo Android e iOS. Nenhum lembrete é enviado pela prévia web."/>:null}
    {enabled&&!valid?<Notice tone="error" message="Use uma hora de 00 a 23 e minutos de 00 a 59."/>:null}
    {error?<Notice tone="error" message={error}/>:null}
    {success?<Notice tone="success" message={saved.enabled?'Lembrete diário ativado.':'Lembrete desativado.'}/>:null}
    <Button title="Salvar lembrete" icon={Check} loading={busy} disabled={loading||!remindersSupported||!dirty||(enabled&&!valid)} onPress={()=>void save()}/>
    {remindersSupported&&error?<Button title="Configurações do aparelho" variant="quiet" icon={Settings} onPress={()=>void Linking.openSettings().catch(()=>setError('Não foi possível abrir as configurações.'))}/>:null}
    <PushSettings />
  </Screen>;
}
const styles=StyleSheet.create({heading:{flexDirection:'row',alignItems:'center',gap:8},grow:{flex:1,minWidth:0},row:{flexDirection:'row',alignItems:'center',gap:12,minHeight:64,borderBottomWidth:1,borderColor:colors.border},time:{flexDirection:'row',alignItems:'flex-end',justifyContent:'center',gap:12,paddingVertical:24},input:{width:80,height:64,textAlign:'center',fontSize:28,fontFamily:fonts.bold,color:colors.text,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:8}});
