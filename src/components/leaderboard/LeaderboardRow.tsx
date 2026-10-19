import { StyleSheet, View } from 'react-native';
import { Avatar } from '@/components/profile/Avatar';
import { ProfileAvatar, VIPBadge } from '@/components/profile/ProfileDecoration';
import { AppText } from '@/components/common/AppText';
import type { LeaderboardEntry } from '@/types/leaderboard';
import { colors, spacing } from '@/constants/theme';
import { AnimatedRankChange } from '@/components/animation/AnimatedRankChange';
export function LeaderboardRow({entry,currentUserId,rankingKey='total'}: {entry:LeaderboardEntry;currentUserId:string|null;rankingKey?:string}) {
  const own=entry.id === currentUserId;
  return <View testID={`leaderboard-row-${entry.position}`} style={[styles.row,own && styles.own]} accessibilityLabel={`${entry.position}º lugar, ${entry.display_name}${entry.vip ? ', Arca VIP' : ''}, ${entry.xp_total} XP${own ? ', você' : ''}`}>
    {own ? <AnimatedRankChange prefix="" motionKey={`rank:${rankingKey}:${entry.id}`} position={entry.position} color={colors.primaryDark} style={styles.position} /> : <AppText variant="label" color={colors.muted} style={styles.position}>{entry.position}</AppText>}{entry.frame === 'classic' ? <Avatar avatarKey={entry.avatar_key} size={42} /> : <ProfileAvatar avatarKey={entry.avatar_key} frame={entry.frame} size={28} animate={false} />}
    <View style={styles.identity}><View style={styles.nameLine}><AppText variant="body" style={styles.name}>{entry.display_name}</AppText>{entry.vip ? <VIPBadge /> : null}</View>{own ? <AppText variant="label" color={colors.primaryDark}>Você</AppText> : null}</View>
    <AppText variant="label" color={colors.muted} style={styles.xp}>{entry.xp_total.toLocaleString('pt-BR')} XP</AppText>
  </View>;
}
const styles=StyleSheet.create({row:{flexDirection:'row',alignItems:'center',gap:spacing.sm,paddingVertical:12,paddingHorizontal:4,minHeight:72,borderBottomWidth:1,borderBottomColor:colors.border},own:{backgroundColor:colors.primarySoft,borderLeftWidth:3,borderLeftColor:colors.primary},position:{minWidth:22,textAlign:'center'},identity:{flex:1,minWidth:0,gap:2},nameLine:{flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:6},name:{flexShrink:1},xp:{maxWidth:'30%',textAlign:'right'}});
