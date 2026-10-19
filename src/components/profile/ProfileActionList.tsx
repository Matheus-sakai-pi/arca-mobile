import type { PropsWithChildren } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { ChevronRight, type LucideIcon } from '@/components/icons';
import { AppText } from '@/components/common/AppText';
import { colors, fonts, surfaces } from '@/constants/theme';

export function ProfileActionGroup({title,children}:PropsWithChildren<{title:string}>) {
  return <View style={styles.group}><AppText variant="label" color={colors.muted} accessibilityRole="header" style={styles.groupTitle}>{title}</AppText><View style={styles.card}>{children}</View></View>;
}

export function ProfileActionRow({title,icon:Icon,onPress,disabled=false,loading=false,danger=false}:{title:string;icon:LucideIcon;onPress:()=>void;disabled?:boolean;loading?:boolean;danger?:boolean}) {
  const ink=danger ? colors.error : colors.text;
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{disabled:disabled || loading,busy:loading}} disabled={disabled || loading} onPress={onPress} style={({pressed})=>[styles.row,pressed && styles.pressed,(disabled || loading) && styles.disabled]}>
    <Icon size={26} color={danger ? colors.error : colors.muted} />
    <AppText style={styles.title} color={ink}>{title}</AppText>
    {loading ? <ActivityIndicator size="small" color={ink} /> : <ChevronRight size={18} color={danger ? colors.error : colors.muted} />}
  </Pressable>;
}

const styles=StyleSheet.create({
  group:{width:'100%'},
  groupTitle:{paddingBottom:6,textTransform:'uppercase',letterSpacing:0.6},
  card:{...surfaces.card,paddingHorizontal:14,overflow:'hidden'},
  row:{minHeight:56,flexDirection:'row',alignItems:'center',gap:12,paddingVertical:14,paddingHorizontal:2,borderBottomWidth:1,borderColor:colors.border},
  title:{flex:1,minWidth:0,fontFamily:fonts.medium},
  pressed:{backgroundColor:colors.primarySoft},
  disabled:{opacity:0.5},
});
