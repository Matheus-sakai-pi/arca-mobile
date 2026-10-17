import { useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Crown, RefreshCw, Trophy, UsersRound } from 'lucide-react-native';
import { Screen } from '@/components/common/Screen';
import { AppText } from '@/components/common/AppText';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States';
import { Notice } from '@/components/common/Notice';
import { IconButton } from '@/components/common/IconButton';
import { LeaderboardPodium } from '@/components/leaderboard/LeaderboardPodium';
import { LeaderboardRow } from '@/components/leaderboard/LeaderboardRow';
import { RankingTabs } from '@/components/leaderboard/RankingTabs';
import { Button } from '@/components/common/Button';
import type { RankingScope } from '@/types/leaderboard';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import { useAuth } from '@/hooks/useAuth';
import { ownPositionOutsideTop } from '@/lib/leaderboard';
import { LearningStats } from '@/components/learning/LearningStats';
import { useLearning } from '@/providers/LearningProvider';
import { isSupabaseConfigured } from '@/lib/supabase';
import { colors, fonts, spacing } from '@/constants/theme';
export default function Ranking() {
  const [scope,setScope]=useState<RankingScope>('total');
  const {data,loading,error,refreshing,refresh}=useLeaderboard(scope);
  const {session}=useAuth();
  const {profile,progress}=useLearning();
  const own = data ? ownPositionOutsideTop(data) : null;
  const currentUserId = session?.user.id ?? null;
  return <Screen scene="ark" style={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>void refresh()} tintColor={colors.primary} colors={[colors.primary]} />}>
    <View style={styles.header}><View style={styles.heading}><View style={styles.titleRow}><AppText accessibilityRole="header" style={styles.title}>Ranking</AppText><Crown size={26} color={colors.gold} fill={colors.gold} /></View><AppText style={styles.subtitle}>Cada passo merece ser celebrado.</AppText></View><IconButton icon={RefreshCw} label="Atualizar ranking" disabled={refreshing || !isSupabaseConfigured} onPress={()=>void refresh()} /></View>
    {progress ? <LearningStats appearance="ranking" motionKey="ranking" xp={progress.xp} streak={profile?.current_streak ?? 0} /> : null}
    <RankingTabs value={scope} onChange={setScope} />
    {scope === 'weekly' ? <View style={scopeStyles.context}><AppText variant="small" color={colors.muted}>{data?.period ? `${new Date(data.period.start).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',timeZone:'America/Sao_Paulo'})} a ${new Date(Date.parse(data.period.end)-1).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',timeZone:'America/Sao_Paulo'})} · Horário de Brasília` : 'Semana de segunda a domingo · Horário de Brasília'}</AppText></View> : null}
    {scope === 'friends' && currentUserId ? <Button title="Gerenciar amigos" icon={UsersRound} variant="secondary" onPress={()=>router.push('/friends')} /> : null}
    {!isSupabaseConfigured ? <EmptyState icon={Trophy} title="Ranking indisponível" message="O ranking estará disponível quando a conexão do aplicativo estiver configurada." />
      : scope === 'friends' && !currentUserId ? <><EmptyState icon={UsersRound} artwork="friends" title="Estude com seus amigos" message="Entre na sua conta para adicionar amigos e comparar o XP total." /><Button title="Entrar" onPress={()=>router.push('/(auth)/login')} /></>
      : loading ? <LoadingState message="Buscando o ranking…" />
      : error && !data ? <ErrorState message={error} onRetry={()=>void refresh()} />
      : data ? <>
        {error ? <Notice tone="error" message={error} /> : null}
        {scope === 'friends' && data.top.length === 1 && data.top[0]?.id === currentUserId ? <Notice message="Ainda não há amizades aceitas. Adicione amigos para estudar juntos." /> : null}
        {data.top.length ? <><View style={styles.leaders}><LeaderboardPodium rankingKey={scope} entries={data.top.slice(0,3)} currentUserId={currentUserId} /></View>
          {data.top.length > 3 ? <View testID="leaderboard-list" style={styles.list}>{data.top.slice(3).map(entry=><LeaderboardRow key={entry.id} rankingKey={scope} entry={entry} currentUserId={currentUserId} />)}</View> : null}
          {own ? <View style={styles.own}><AppText variant="h3">Sua posição</AppText><LeaderboardRow rankingKey={scope} entry={own} currentUserId={currentUserId} /></View> : null}
        </> : <EmptyState icon={Trophy} title="A jornada está começando" message="Ainda não há participantes no ranking." />}
      </> : null}
  </Screen>;
}
const scopeStyles=StyleSheet.create({context:{backgroundColor:'rgba(255,255,255,0.92)',paddingHorizontal:12,paddingVertical:8,borderRadius:8}});
const styles=StyleSheet.create({content:{gap:20},leaders:{gap:spacing.xs},totalLabel:{alignSelf:'flex-start',backgroundColor:colors.surface,paddingHorizontal:12,paddingVertical:6,borderRadius:8},header:{flexDirection:'row',alignItems:'flex-start',gap:12,paddingTop:12},heading:{flex:1,minWidth:0,gap:6},titleRow:{flexDirection:'row',alignItems:'center',gap:10,flexWrap:'wrap'},title:{fontFamily:fonts.heavy,fontSize:36,lineHeight:44,color:colors.surface,textShadowColor:'rgba(0,46,110,0.4)',textShadowOffset:{width:0,height:2},textShadowRadius:7},subtitle:{color:colors.surface,fontSize:16,lineHeight:23,textShadowColor:'rgba(0,35,85,0.65)',textShadowOffset:{width:0,height:1},textShadowRadius:5},list:{backgroundColor:colors.surface,borderRadius:24,paddingHorizontal:12,paddingVertical:4,overflow:'hidden'},own:{gap:spacing.sm,backgroundColor:colors.surface,borderRadius:20,padding:12}});
