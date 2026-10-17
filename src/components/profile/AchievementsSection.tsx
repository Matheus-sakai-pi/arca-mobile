import { StyleSheet, View } from 'react-native';
import { Award, Check, LockKeyhole } from 'lucide-react-native';
import { AppText } from '@/components/common/AppText';
import { Notice } from '@/components/common/Notice';
import { Button } from '@/components/common/Button';
import { achievementDefinitions } from '@/lib/achievements';
import { useRewardMotion } from '@/providers/RewardMotionProvider';
import { AchievementIcon } from './AchievementIcon';
import { colors, spacing } from '@/constants/theme';
export function AchievementsSection() {
  const {achievements,achievementError,retryAchievements}=useRewardMotion();
  return <View testID="achievements-section" style={styles.section}><View style={styles.heading}><Award size={22} color={colors.goldInk} /><AppText variant="h3">Conquistas</AppText><AppText variant="small" color={colors.muted}>{achievements?.unlocked.length ?? 0}/{achievementDefinitions.length}</AppText></View>
    {achievementError ? <><Notice tone="error" message={achievementError} /><Button title="Tentar novamente" variant="quiet" onPress={retryAchievements} /></> : null}
    {achievementDefinitions.map(item=>{const unlocked=achievements?.unlocked.includes(item.id) ?? false;return <View key={item.id} testID={`achievement-${item.id}`} accessible accessibilityLabel={`${item.title}, ${unlocked ? 'desbloqueada' : 'bloqueada'}. ${item.description}`} style={[styles.row,unlocked && styles.unlocked]}><AchievementIcon id={item.id} unlocked={unlocked} /><View style={styles.text}><AppText variant="label" color={unlocked ? colors.text : colors.muted}>{item.title}</AppText><AppText variant="small" color={colors.muted}>{item.description}</AppText></View>{unlocked ? <Check size={18} color={colors.success} /> : <LockKeyhole size={16} color={colors.muted} />}</View>;})}
  </View>;
}
const styles=StyleSheet.create({section:{gap:spacing.sm},heading:{flexDirection:'row',alignItems:'center',gap:spacing.sm},row:{flexDirection:'row',gap:spacing.sm,alignItems:'center',paddingVertical:spacing.sm,borderBottomWidth:1,borderColor:colors.border},unlocked:{borderColor:'#E9D58E'},text:{flex:1,minWidth:0,gap:2}});
