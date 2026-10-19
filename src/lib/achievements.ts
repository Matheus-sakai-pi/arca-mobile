import type { LearningProgress, Unit } from '../types/learning.ts';

export const achievementDefinitions = [
  {id:'first_step',title:'Primeiro Passo',description:'Complete sua primeira lição.',kind:'lessons',target:1},
  {id:'perfect_lesson',title:'Sem Errar',description:'Complete uma lição com 100% de precisão.',kind:'perfect',target:1},
  {id:'streak_3',title:'3 Dias de Jornada',description:'Alcance uma sequência de 3 dias.',kind:'streak',target:3},
  {id:'streak_7',title:'7 Dias de Jornada',description:'Alcance uma sequência de 7 dias.',kind:'streak',target:7},
  {id:'scholar',title:'Estudioso',description:'Complete 10 lições diferentes.',kind:'lessons',target:10},
  {id:'unit_1',title:'Conhecendo a Bíblia',description:'Complete a Unidade 1.',kind:'unit',target:1},
  {id:'unit_2',title:'Histórias Fundamentais',description:'Complete a Unidade 2.',kind:'unit',target:2},
  {id:'xp_500',title:'500 XP',description:'Alcance 500 XP.',kind:'xp',target:500},
  {id:'xp_1000',title:'1000 XP',description:'Alcance 1000 XP.',kind:'xp',target:1000},
  {id:'unit_3',title:'Gênesis e os Patriarcas',description:'Complete a Unidade 3.',kind:'unit',target:3},
  {id:'unit_4',title:'Caminhada no Deserto',description:'Complete a Unidade 4.',kind:'unit',target:4},
  {id:'unit_5',title:'Reis e Sabedoria',description:'Complete a Unidade 5.',kind:'unit',target:5},
  {id:'unit_6',title:'Voz dos Profetas',description:'Complete a Unidade 6.',kind:'unit',target:6},
  {id:'unit_7',title:'Vida de Jesus',description:'Complete a Unidade 7.',kind:'unit',target:7},
  {id:'unit_8',title:'Parábolas',description:'Complete a Unidade 8.',kind:'unit',target:8},
  {id:'unit_9',title:'Primeiras Comunidades',description:'Complete a Unidade 9.',kind:'unit',target:9},
  {id:'unit_10',title:'Cartas Apostólicas',description:'Complete a Unidade 10.',kind:'unit',target:10},
  {id:'course_complete',title:'Jornada Completa',description:'Complete todas as unidades.',kind:'course',target:1},
  {id:'lessons_25',title:'Aprendiz Fiel',description:'Complete 25 lições diferentes.',kind:'lessons',target:25},
  {id:'lessons_50',title:'Discípulo Dedicado',description:'Complete 50 lições diferentes.',kind:'lessons',target:50},
  {id:'lessons_100',title:'Guardião da Palavra',description:'Complete 100 lições diferentes.',kind:'lessons',target:100},
  {id:'streak_14',title:'Duas Semanas de Fé',description:'Alcance uma sequência de 14 dias.',kind:'streak',target:14},
  {id:'streak_30',title:'Um Mês de Jornada',description:'Alcance uma sequência de 30 dias.',kind:'streak',target:30},
  {id:'streak_100',title:'Cem Dias de Jornada',description:'Alcance uma sequência de 100 dias.',kind:'streak',target:100},
  {id:'xp_2500',title:'2500 XP',description:'Alcance 2500 XP.',kind:'xp',target:2500},
  {id:'xp_5000',title:'5000 XP',description:'Alcance 5000 XP.',kind:'xp',target:5000},
  {id:'xp_10000',title:'10 mil XP',description:'Alcance 10000 XP.',kind:'xp',target:10000},
] as const;
export type AchievementId=typeof achievementDefinitions[number]['id'];
export type Achievement=typeof achievementDefinitions[number];
export type AchievementState={version:1;unlocked:AchievementId[];pending:AchievementId[]};
export type AchievementFacts={progress:LearningProgress;units:readonly Unit[];longestStreak:number};
const ids=new Set<string>(achievementDefinitions.map(item=>item.id));
export const achievementKey=(scope:string)=>`arca.achievements.${scope}.v1`;
export function parseAchievements(raw:string|null):AchievementState {
  if(raw === null) return {version:1,unlocked:[],pending:[]};
  const data:unknown=JSON.parse(raw);
  if(!data || typeof data !== 'object' || !('version' in data) || data.version !== 1 || !('unlocked' in data) || !Array.isArray(data.unlocked) || !('pending' in data) || !Array.isArray(data.pending)) throw new Error('Conquistas locais inválidas.');
  const valid=(values:unknown[]):values is AchievementId[]=>values.every(id=>typeof id === 'string' && ids.has(id)) && new Set(values).size === values.length;
  const unlocked=data.unlocked,pending=data.pending;
  if(!valid(unlocked) || !valid(pending) || pending.some(id=>!unlocked.includes(id))) throw new Error('Conquistas locais inválidas.');
  return {version:1,unlocked:[...unlocked],pending:[...pending]};
}
export function eligibleAchievements({progress,units,longestStreak}:AchievementFacts):AchievementId[] {
  return achievementDefinitions.filter(item=>{
    switch(item.kind) {
      case 'xp': return progress.xp >= item.target;
      case 'lessons': return new Set(progress.completedLessonIds).size >= item.target;
      case 'streak': return longestStreak >= item.target;
      case 'perfect': return !!progress.lastResult && progress.lastResult.accuracy === 100 && progress.completedLessonIds.includes(progress.lastResult.lessonId);
      case 'unit': { const unit=units[item.target-1]; return !!unit && unit.lessons.length > 0 && unit.lessons.every(lesson=>progress.completedLessonIds.includes(lesson.id)); }
      case 'course': return units.length > 0 && units.every(unit=>unit.lessons.length > 0 && unit.lessons.every(lesson=>progress.completedLessonIds.includes(lesson.id)));
    }
  }).map(item=>item.id);
}
export function unlockAchievements(state:AchievementState,eligible:readonly AchievementId[],announce:boolean):AchievementState {
  const fresh=eligible.filter(id=>!state.unlocked.includes(id));
  return {version:1,unlocked:[...state.unlocked,...fresh],pending:announce ? [...state.pending,...fresh] : state.pending};
}
export function createAchievementStore(storage:{getItem:(key:string)=>Promise<string|null>;setItem:(key:string,value:string)=>Promise<void>},scope:string) {
  let current:AchievementState|null=null;
  let queue:Promise<unknown>=Promise.resolve();
  function serial<T>(task:()=>Promise<T>) { const next=queue.then(task); queue=next.catch(()=>undefined); return next; }
  async function commit(next:AchievementState) { await storage.setItem(achievementKey(scope),JSON.stringify(next)); current=next; return next; }
  return {
    load:()=>serial(async()=>current ?? (current=parseAchievements(await storage.getItem(achievementKey(scope))))),
    evaluate:(facts:AchievementFacts,announce=true)=>serial(async()=>{
      if(!current) throw new Error('Conquistas ainda não carregadas.');
      const next=unlockAchievements(current,eligibleAchievements(facts),announce);
      return next.unlocked.length === current.unlocked.length ? current : commit(next);
    }),
    // Conquistas vindas de outro aparelho entram sem comemoração repetida.
    merge:(remote:readonly AchievementId[])=>serial(async()=>{
      if(!current) throw new Error('Conquistas ainda não carregadas.');
      const next=unlockAchievements(current,remote,false);
      return next.unlocked.length === current.unlocked.length ? current : commit(next);
    }),
    acknowledge:(id:AchievementId)=>serial(async()=>{
      if(!current) throw new Error('Conquistas ainda não carregadas.');
      if(current.pending[0] !== id) return current;
      return commit({...current,pending:current.pending.slice(1)});
    }),
  };
}
