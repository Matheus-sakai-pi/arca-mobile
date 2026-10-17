import type { PropsWithChildren } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { AppText } from '@/components/common/AppText';
import { colors, fonts } from '@/constants/theme';

export function ProfileActionGroup({title,children}:PropsWithChildren<{title:string}>) {
  return <View style={styles.group}><AppText variant="label" color={colors.muted} accessibilityRole="header" style={styles.groupTitle}>{title}</AppText>{children}</View>;
}

export function ProfileActionRow({title,icon:Icon,onPress,disabled=false,loading=false,danger=false}:{title:string;icon:LucideIcon;onPress:()=>void;disabled?:boolean;loading?:boolean;danger?:boolean}) {
  const ink=danger ? colors.error : colors.text;
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{disabled:disabled || loading,busy:loading}} disabled={disabled || loading} onPress={onPress} style={({pressed})=>[styles.row,pressed && styles.pressed,(disabled || loading) && styles.disabled]}>
    <Icon size={21} color={danger ? colors.error : colors.muted} />
    <AppText style={styles.title} color={ink}>{title}</AppText>
    {loading ? <ActivityIndicator size="small" color={ink} /> : <ChevronRight size={18} color={danger ? colors.error : colors.muted} />}
  </Pressable>;
}

const styles=StyleSheet.create({
  group:{width:'100%'},
  groupTitle:{paddingBottom:6},
  row:{minHeight:56,flexDirection:'row',alignItems:'center',gap:12,paddingVertical:14,paddingHorizontal:2,borderBottomWidth:1,borderColor:colors.border},
  title:{flex:1,minWidth:0,fontFamily:fonts.medium},
  pressed:{backgroundColor:'rgba(255,255,255,0.65)'},
  disabled:{opacity:0.5},
});
