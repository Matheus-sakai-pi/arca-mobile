import { useState } from 'react';
import { Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Crown } from '@/components/icons';
import { Avatar } from '@/components/profile/Avatar';
import { ProfileAvatar, VIPBadge } from '@/components/profile/ProfileDecoration';
import { AppText } from '@/components/common/AppText';
import { redesignAssets } from '@/constants/redesignAssets';
import type { LeaderboardEntry } from '@/types/leaderboard';
import { colors, fonts, layout, radius, spacing } from '@/constants/theme';
import { PodiumEntrance } from '@/components/animation/PodiumEntrance';
import { AnimatedRankChange } from '@/components/animation/AnimatedRankChange';
const awards = {
  1: { ink: '#805000', ring: '#FFC72A', height: 228, faceStart: 0.16 },
  2: { ink: '#465C86', ring: '#AEC8F6', height: 204, faceStart: 0.31 },
  3: { ink: '#8B3D1D', ring: '#F9A55F', height: 184, faceStart: 0.25 },
} as const;
export function LeaderboardPodium({ entries, currentUserId, rankingKey='total' }: { entries: LeaderboardEntry[]; currentUserId: string | null; rankingKey?: string }) {
  const { fontScale, width } = useWindowDimensions();
  const textScale = Math.max(1, Math.min(fontScale, 1.6));
  const [nameHeights,setNameHeights]=useState<Record<string,number>>({});
  const nameKey=(person:LeaderboardEntry)=>`${person.id}:${person.display_name}:${textScale}`;
  const nameHeight=Math.max(36*textScale,...entries.map(person=>nameHeights[nameKey(person)] ?? 0));
  // Taller artwork also grows its rim, so reserve enough front-face room for the number.
  const extraHeight=(nameHeight-36*textScale)/(1-Math.max(...Object.values(awards).map(award=>award.faceStart)));
  const slotWidth=(Math.min(width,layout.maxWidth)-spacing.md*2-8)/3;
  return <View style={styles.podium} testID="leaderboard-podium">
    <View style={styles.platform} pointerEvents="none"><Image source={redesignAssets.platform} resizeMode="contain" style={styles.image} accessible={false} /></View>
    {([2, 1, 3] as const).map(position => {
      const person = entries.find(entry => entry.position === position);
      if (!person) return <View key={position} style={styles.emptyColumn} />;
      const award = awards[position], own = person.id === currentUserId;
      const pedestalHeight = award.height * textScale + extraHeight;
      const avatarSize=Math.max(28,Math.min(position === 1 ? 96 : 80,Math.floor(slotWidth-(position === 1 ? 12 : 24))));
      return <PodiumEntrance key={position} position={position}><View style={styles.column} accessibilityLabel={`${position}º lugar, ${person.display_name}${person.vip ? ', Arca VIP' : ''}, ${person.xp_total} XP${own ? ', você' : ''}`}>
        {position === 1 ? <Crown size={34} color={colors.goldInk} fill={colors.gold} /> : null}
        {/* Sem espaço ao lado do nome no pódio: o selo VIP fica encostado embaixo do avatar. */}
        <View style={styles.avatarSlot}>
          {person.frame === 'classic'
            ? <View testID={`podium-avatar-${position}`} style={[styles.avatarRing, { borderColor: award.ring }]}><Avatar avatarKey={person.avatar_key} size={avatarSize} /></View>
            : <View testID={`podium-avatar-${position}`}><ProfileAvatar avatarKey={person.avatar_key} frame={person.frame} size={avatarSize - 8} animate={false} /></View>}
          {person.vip ? <View testID={`podium-vip-${position}`} style={styles.vipTag} pointerEvents="none"><VIPBadge /></View> : null}
        </View>
        <View testID={`podium-pedestal-${position}`} style={[styles.pedestal, { height: pedestalHeight, paddingTop: pedestalHeight * award.faceStart }]}>
          <View testID={`podium-art-${position}`} style={styles.pedestalArt} pointerEvents="none"><Image source={redesignAssets.podiums[position]} resizeMode="stretch" style={styles.image} accessible={false} /></View>
          <View testID={`podium-rank-${position}`} style={styles.rankArea}>
            {own ? <AnimatedRankChange prefix="" position={position} motionKey={`rank:${rankingKey}:${person.id}`} variant="h1" color={award.ink} style={styles.rank} /> : <AppText variant="h1" color={award.ink} style={styles.rank}>{position}</AppText>}
          </View>
          <View testID={`podium-identity-${position}`} style={[styles.identity,own && styles.own]}><View style={{minHeight:nameHeight,width:'100%',justifyContent:'center'}}><AppText variant="label" style={styles.name} onLayout={event=>{const measured=Math.ceil(event.nativeEvent.layout.height);const key=nameKey(person);setNameHeights(previous=>previous[key] === measured ? previous : {...previous,[key]:measured});}}>{person.display_name}</AppText></View><AppText variant="label" color={award.ink} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>{person.xp_total.toLocaleString('pt-BR')} XP</AppText><View style={{ height: 21 * textScale }}>{own ? <AppText variant="label" color={colors.primaryDark}>Você</AppText> : null}</View></View>
        </View>
      </View></PodiumEntrance>;
    })}
  </View>;
}
const styles = StyleSheet.create({
  podium: { width: '100%', maxWidth: 560, alignSelf: 'center', flexDirection: 'row', alignItems: 'flex-end', gap: 4, paddingTop: spacing.xs, paddingBottom: 34 },
  platform: { position: 'absolute', bottom: 0, left: 0, width: '100%', height: 76 },
  image: { width: '100%', height: '100%' },
  pedestalArt: { position: 'absolute', top: 0, left: 0, bottom: 0, right: 0 },
  // Only the outer row slots grow. Vertical flex here makes Yoga displace the podium bases.
  column: { width: '100%', minWidth: 0, alignItems: 'center', gap: 4 },
  emptyColumn: { flex: 1, minWidth: 0 },
  avatarSlot: { alignItems: 'center' },
  vipTag: { position: 'absolute', left: 0, right: 0, bottom: -10, alignItems: 'center' },
  avatarRing: { padding: 3, borderWidth: 3, borderRadius: radius.pill, backgroundColor: colors.surface, boxShadow: '0 5px 15px rgba(44,70,115,0.18)' },
  own: { backgroundColor: '#F0F6FF' },
  pedestal: { width: '100%', borderRadius: 12, alignItems: 'center', gap: 4, paddingHorizontal: 4, paddingBottom: 10 },
  // Each bitmap has its own transparent margin and elliptical rim above the front face.
  rankArea: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
  rank: { fontSize: 30, lineHeight: 36, minWidth: 36, textAlign: 'center' },
  identity: { width: '100%', justifyContent: 'center', alignItems: 'center', gap: 2, paddingVertical: 4, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.84)' },
  name: { textAlign: 'center', fontFamily: fonts.heavy, fontSize: 13, lineHeight: 18 },
});
