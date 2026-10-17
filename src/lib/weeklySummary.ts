import type { StudyEntry } from './studyStore.ts';
import { localDay, subjectPerformance } from './studyStore.ts';
import type { Unit } from '../types/learning.ts';

export function weeklySummary(history: readonly StudyEntry[], unit: Unit, now=new Date(), offset=0) {
  const end=new Date(now.getFullYear(),now.getMonth(),now.getDate()-offset*7);
  const days=Array.from({length:7},(_,index)=>localDay(new Date(end.getFullYear(),end.getMonth(),end.getDate()-6+index)));
  const entries=history.filter(entry=>days.includes(entry.day));
  const exercises=entries.reduce((sum,entry)=>sum+entry.result.total,0);
  const correct=entries.reduce((sum,entry)=>sum+entry.result.correct,0);
  const previousEnd=new Date(end.getFullYear(),end.getMonth(),end.getDate()-7);
  const previousDays=Array.from({length:7},(_,index)=>localDay(new Date(previousEnd.getFullYear(),previousEnd.getMonth(),previousEnd.getDate()-6+index)));
  const previous=subjectPerformance(history.filter(entry=>previousDays.includes(entry.day)),unit);
  const subjects=subjectPerformance(entries,unit);
  const improved=subjects.map(subject=>{
    const old=previous.find(item=>item.unitId===subject.unitId);
    return {...subject,change:old && old.total>=10 && subject.total>=10 ? subject.accuracy-old.accuracy : null};
  }).filter(subject=>subject.change!==null && subject.change>0).sort((a,b)=>b.change!-a.change!)[0] ?? null;
  return {days:days.map(day=>({day,exercises:entries.filter(entry=>entry.day===day).reduce((sum,entry)=>sum+entry.result.total,0)})),
    activeDays:new Set(entries.map(entry=>entry.day)).size,exercises,lessons:entries.length,accuracy:exercises ? Math.round(correct/exercises*100) : null,
    xp:entries.reduce((sum,entry)=>sum+entry.result.xpEarned,0),improved,
    weakest:[...subjects].filter(item=>item.total>=10).sort((a,b)=>a.accuracy-b.accuracy)[0] ?? null,
    from:days[0]!,to:days[6]!};
}
