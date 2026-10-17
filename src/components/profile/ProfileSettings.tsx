import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Accessibility, Goal, Vibrate, Volume2, X } from 'lucide-react-native';
import { AppText } from '@/components/common/AppText';
import { IconButton } from '@/components/common/IconButton';
import { Notice } from '@/components/common/Notice';
import { usePreferences } from '@/providers/PreferencesProvider';
import { useMotionPreference } from '@/hooks/useMotionPreference';
import { colors, spacing } from '@/constants/theme';

export function ProfileSettings({onClose}:{onClose:()=>void}) {
  const {soundEnabled,hapticsEnabled,reduceMotion,dailyGoal,ready,error:loadError,updatePreferences}=usePreferences();
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState(false);
  const reduced=useMotionPreference();
  async function change(values:Parameters<typeof updatePreferences>[0]) { setBusy(true);setError(false); try { await updatePreferences(values); } catch { setError(true); } finally { setBusy(false); } }
  return <Modal visible transparent animationType={reduced ? 'none' : 'fade'} onRequestClose={onClose}><ScrollView style={styles.overlay} contentContainerStyle={styles.overlayContent}><View style={styles.panel} accessibilityViewIsModal><View style={styles.heading}><AppText variant="h2" style={styles.label}>Configurações</AppText><IconButton icon={X} label="Fechar configurações" onPress={onClose} /></View>
    {[{label:'Efeitos sonoros',Icon:Volume2,value:soundEnabled,key:'soundEnabled' as const},{label:'Vibração',Icon:Vibrate,value:hapticsEnabled,key:'hapticsEnabled' as const},{label:'Reduzir animações',Icon:Accessibility,value:reduceMotion,key:'reduceMotion' as const}].map(({label,Icon,value,key})=><View key={key} style={styles.row}><Icon size={22} color={colors.primaryDark} /><AppText style={styles.label}>{label}</AppText><Switch accessibilityLabel={label} value={value} disabled={busy || !ready} onValueChange={value=>void change({[key]:value})} trackColor={{false:colors.track,true:colors.primary}} /></View>)}
    <View style={styles.row}><Goal size={22} color={colors.primaryDark} /><AppText>Meta diária</AppText></View><View accessibilityRole="radiogroup" style={styles.goals}>{[10,20,30].map(value=><Pressable key={value} accessibilityRole="radio" accessibilityLabel={`${value} exercícios por dia`} accessibilityState={{checked:dailyGoal === value,disabled:busy || !ready}} disabled={busy || !ready} onPress={()=>void change({dailyGoal:value})} style={[styles.goal,dailyGoal === value && styles.selected]}><AppText variant="h3" color={dailyGoal === value ? colors.primaryDark : colors.text}>{value}</AppText><AppText variant="small">exercícios</AppText></Pressable>)}</View>
    {error || loadError ? <Notice tone="error" message={loadError ?? 'Não foi possível guardar a preferência. Tente novamente.'} /> : null}</View></ScrollView></Modal>;
}
const styles=StyleSheet.create({overlay:{flex:1,backgroundColor:'rgba(34,33,42,0.45)'},overlayContent:{flexGrow:1,justifyContent:'center',alignItems:'center',padding:spacing.md},panel:{width:'100%',maxWidth:420,padding:spacing.lg,backgroundColor:colors.surface,borderRadius:8,gap:spacing.md},heading:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:spacing.xs},row:{flexDirection:'row',alignItems:'center',gap:spacing.sm,paddingVertical:spacing.sm},label:{flex:1},goals:{flexDirection:'row',flexWrap:'wrap',gap:spacing.xs},goal:{flex:1,minWidth:66,minHeight:72,padding:spacing.xs,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:colors.border,borderRadius:8},selected:{backgroundColor:colors.primarySoft,borderColor:colors.primary}});
