// Visual QA fixture only; never imported by the production ranking screen.
import { useState } from 'react';
import { View } from 'react-native';
import { Screen } from '@/components/common/Screen';
import { Button } from '@/components/common/Button';
import { AppText } from '@/components/common/AppText';
import { LeaderboardPodium } from '@/components/leaderboard/LeaderboardPodium';
import { LeaderboardRow } from '@/components/leaderboard/LeaderboardRow';
import { AvatarPicker } from '@/components/profile/AvatarPicker';
import { avatarOptions } from '@/constants/avatarKeys';
import type { LeaderboardEntry } from '@/types/leaderboard';
const rows:LeaderboardEntry[]=Array.from({length:10},(_,i)=>({id:`test-${i}`,display_name:i === 1 ? 'Nome de teste bem comprido' : `Aprendiz ${i+1}`,avatar_key:avatarOptions[i%5]!.key,xp_total:3250-i*100,position:i+1}));
export default function RankingPreview() {
  const [open,setOpen]=useState(false),[key,setKey]=useState('avatar-03');
  const [count,setCount]=useState(10);
  const [own,setOwn]=useState(1);
  return <Screen scene="ark"><AppText variant="h1">Ranking</AppText><AppText variant="small">Validação visual · dados de teste</AppText>
    <LeaderboardPodium entries={rows.slice(0,Math.min(count,3)).map(row=>row.id === 'test-0' ? {...row,avatar_key:key}:row)} currentUserId={`test-${own-1}`} />
    <View style={{gap:8}}>{rows.slice(3,count).map(row=><LeaderboardRow key={row.id} entry={row} currentUserId="test-0" />)}</View>
    <AppText variant="h3">Sua posição</AppText><LeaderboardRow entry={{id:'test-outside',display_name:'Nome de teste fora do Top 10',avatar_key:key,xp_total:480,position:37}} currentUserId="test-outside" />
    <Button title="Escolher avatar" onPress={()=>setOpen(true)} />
    <Button title="Um participante" onPress={()=>setCount(1)} />
    <Button title="Dois participantes" onPress={()=>setCount(2)} />
    <Button title="Dez participantes" onPress={()=>setCount(10)} />
    <Button title="Eu em primeiro" onPress={()=>setOwn(1)} />
    <Button title="Eu em segundo" onPress={()=>setOwn(2)} />
    <Button title="Eu em terceiro" onPress={()=>setOwn(3)} />
    <AppText>Avatar salvo no teste: {key}</AppText>
    {open ? <AvatarPicker currentKey={key} onClose={()=>setOpen(false)} onSave={async next=>setKey(next)} /> : null}
  </Screen>;
}
