import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
const source=async(path:string)=>readFile(new URL('../src/'+path,import.meta.url),'utf8');

test('ranking presentation keeps real data, refresh and exceptional states with functional scope tabs',async()=>{
  const ranking=await source('app/(tabs)/ranking.tsx');
  for(const logic of ['useLeaderboard(scope)','profile?.current_streak ?? 0','xp={progress.xp}','ownPositionOutsideTop(data)','data.top.slice(0,3)','data.top.slice(3)','error && !data','refreshing || !isSupabaseConfigured']) assert.ok(ranking.includes(logic));
  assert.match(ranking,/appearance="ranking"/);
  assert.doesNotMatch(ranking,/TabHeader|SEGUIDORES|sceneScrolls/);
  assert.match(ranking,/RankingTabs value=\{scope\} onChange=\{setScope\}/);
  // Estilo plano: título escuro sobre fundo branco, sem sombra de texto.
  assert.match(ranking,/fontSize:32,lineHeight:40,color:colors.text/);
  assert.doesNotMatch(ranking,/textShadowColor|scene=/);
  const row=await source('components/leaderboard/LeaderboardRow.tsx');
  assert.match(row,/borderBottomWidth:1/);
  assert.doesNotMatch(row,/borderRadius|borderWidth:1|backgroundColor:colors.surface/);
  assert.match(row,/borderLeftColor:colors.primary/);
});

test('ranking stats is opt-in, shows day units and keeps shared animated XP and streak values',async()=>{
  const stats=await source('components/learning/LearningStats.tsx');
  assert.match(stats,/appearance='default'/);
  assert.match(stats,/appearance === 'ranking'/);
  assert.match(stats,/showcase: \{ minHeight: 68/);
  assert.match(stats,/showcaseValue: \{ fontSize: 20, lineHeight: 26/);
  assert.match(stats,/<Flame size=\{showcase \? 28 : 24\} \/>/);
  assert.match(stats, /<EnergyMeter inline/);
  assert.match(stats,/streak === 1 \? 'dia' : 'dias'/);
  assert.match(stats,/useCounterMotion\(`\$\{motionKey\}:xp`,xp,entrance,'xp'\)/);
  assert.match(stats,/useCounterMotion\(`\$\{motionKey\}:streak`,streak,entrance,'streak'\)/);
  for(const route of ['home','profile','learn']) assert.doesNotMatch(await source(`app/(tabs)/${route}.tsx`),/appearance="ranking"/);
});
