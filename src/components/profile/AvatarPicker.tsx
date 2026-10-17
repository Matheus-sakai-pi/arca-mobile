import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Check, Save, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from './Avatar';
import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { IconButton } from '@/components/common/IconButton';
import { Notice } from '@/components/common/Notice';
import { avatarOptions, resolveAvatarKey, type AvatarKey } from '@/constants/avatarKeys';
import { colors, radius, spacing } from '@/constants/theme';
export function AvatarPicker({currentKey,onSave,onClose}: {currentKey:string;onSave:(key:AvatarKey)=>Promise<void>;onClose:()=>void}) {
  const [selected,setSelected] = useState<AvatarKey>(resolveAvatarKey(currentKey));
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState<string|null>(null);
  async function save() {
    if (saving) return;
    setSaving(true);setError(null);
    try { await onSave(selected);onClose(); }
    catch { setError('Não foi possível salvar o avatar. Confira sua conexão e tente novamente.'); }
    finally { setSaving(false); }
  }
  return <Modal visible transparent animationType="fade" onRequestClose={()=>{if(!saving)onClose();}}>
    <SafeAreaView style={styles.overlay}><View style={styles.dialog} accessibilityViewIsModal>
      <View style={styles.header}><AppText variant="h3" style={styles.title}>Escolher avatar</AppText><IconButton icon={X} label="Fechar seleção de avatar" disabled={saving} onPress={onClose} /></View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.grid}>
        {avatarOptions.map(option=><Pressable key={option.key} accessibilityRole="radio" accessibilityLabel={option.label} aria-checked={selected === option.key} accessibilityState={{checked:selected === option.key,disabled:saving}} disabled={saving} onPress={()=>{setSelected(option.key);setError(null);}} style={[styles.option,selected === option.key && styles.selected]}>
          <Avatar avatarKey={option.key} size={72} /><View style={styles.label}><AppText variant="label" style={styles.optionName}>{option.label}</AppText>{selected === option.key ? <Check size={16} color={colors.primaryDark} /> : null}</View>
        </Pressable>)}
      </ScrollView>
      {error ? <Notice tone="error" message={error} /> : null}
      <Button title="Salvar" icon={Save} loading={saving} onPress={()=>void save()} />
    </View></SafeAreaView>
  </Modal>;
}
const styles=StyleSheet.create({
  overlay:{flex:1,backgroundColor:'rgba(34,33,42,0.45)',alignItems:'center',justifyContent:'center',padding:spacing.md},
  dialog:{width:'100%',maxWidth:420,maxHeight:'95%',borderRadius:radius.lg,backgroundColor:colors.surface,padding:spacing.md,gap:spacing.md},
  header:{flexDirection:'row',alignItems:'center',gap:spacing.xs},title:{flex:1},
  grid:{flexDirection:'row',flexWrap:'wrap',justifyContent:'center',gap:spacing.sm,paddingVertical:spacing.xs},
  option:{width:'45%',minHeight:124,borderWidth:2,borderColor:colors.border,borderRadius:radius.md,alignItems:'center',justifyContent:'center',padding:spacing.xs,gap:spacing.xs},
  selected:{backgroundColor:colors.primarySoft,borderColor:colors.primary},
  label:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:4,minHeight:24,width:'100%'},optionName:{textAlign:'center',flexShrink:1},
});
