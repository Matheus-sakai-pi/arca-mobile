import type { Leaderboard, LeaderboardEntry, RankingScope } from '../types/leaderboard.ts';
import { integer, object } from './backendDecoders.ts';

function entry(value: unknown): LeaderboardEntry {
  if (!object(value) || typeof value.id !== 'string' || !value.id || typeof value.display_name !== 'string'
    || !value.display_name.trim() || typeof value.avatar_key !== 'string' || !integer(value.xp_total)
    || !integer(value.position) || value.position < 1) throw new Error('Ranking recebido em formato inválido.');
  // Explicit projection also discards unexpected server fields.
  return {id:value.id,display_name:value.display_name,avatar_key:value.avatar_key,xp_total:value.xp_total,position:value.position};
}
export function decodeLeaderboard(value: unknown, userId: string | null, scope: RankingScope = 'total'): Leaderboard {
  if (!object(value) || !Array.isArray(value.top) || value.top.length > 10) throw new Error('Ranking recebido em formato inválido.');
  const top = value.top.map(entry);
  if (new Set(top.map(row=>row.id)).size !== top.length || top.some((row,index)=>row.position !== index+1
    || (index > 0 && row.xp_total > top[index-1]!.xp_total))) throw new Error('Ordem do ranking inválida.');
  const current = value.current === null ? null : entry(value.current);
  if (current && current.id !== userId) throw new Error('Posição da conta inválida.');
  if (scope === 'weekly') {
    const period = value.period;
    if (!object(period) || typeof period.start !== 'string' || typeof period.end !== 'string'
      || !Number.isFinite(Date.parse(period.start)) || Date.parse(period.end)-Date.parse(period.start) !== 7*86400000)
      throw new Error('Período do ranking inválido.');
    return {top,current,period:{start:period.start,end:period.end}};
  }
  return {top,current};
}
export function ownPositionOutsideTop(data: Leaderboard): LeaderboardEntry | null {
  return data.current && !data.top.some(row=>row.id === data.current!.id) ? data.current : null;
}
