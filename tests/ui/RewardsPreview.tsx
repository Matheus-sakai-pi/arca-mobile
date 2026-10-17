import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Screen } from '@/components/common/Screen';
import { LearningStats } from '@/components/learning/LearningStats';
import { LeaderboardPodium } from '@/components/leaderboard/LeaderboardPodium';
import { AnimatedRankChange } from '@/components/animation/AnimatedRankChange';
import { ResultCounters } from '@/components/learning/ResultCounters';

// Isolated visual fixture. Its controls never write learning, XP or remote ranking.
export default function RewardsPreview() {
  const [rank,setRank]=useState(12);
  const [streak,setStreak]=useState(6);
  const [xp,setXp]=useState(118);
  const [revision,setRevision]=useState(0);
  const [tick,setTick]=useState(0);
  return <Screen><AppText variant="h3">Prévia isolada de recompensas</AppText><LearningStats motionKey="qa:stats" xp={xp} streak={streak} /><View style={styles.actions}><Button title="Ganhar 20 XP" onPress={()=>setXp(value=>value+20)} /><Button title="Avançar streak" onPress={()=>setStreak(value=>value+1)} /></View><AnimatedRankChange motionKey="qa:rank" position={rank} /><View style={styles.actions}><Button title="Subir no ranking" onPress={()=>setRank(9)} /><Button title="Cair no ranking" onPress={()=>setRank(12)} /></View><LeaderboardPodium currentUserId={null} entries={[1,2,3].map(position=>({id:`fixture-${position}`,display_name:['Ana','Bia','Caio'][position-1]!,avatar_key:'owl',xp_total:400-position*25,position}))} /><ResultCounters result={{attemptId:`qa-${revision}`,lessonId:'fixture',correct:4,total:5,accuracy:80,xpEarned:18,completedAt:'2026-10-07'}} /><Button title="Novo resultado" onPress={()=>setRevision(value=>value+1)} /><Button title="Renderizar sem mudança" onPress={()=>setTick(value=>value+1)} /><AppText>{tick}</AppText></Screen>;
}
const styles=StyleSheet.create({actions:{gap:8}});
