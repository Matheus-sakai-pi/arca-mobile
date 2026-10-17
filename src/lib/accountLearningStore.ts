import { combineUnits, initialUnit, journeyUnits } from '../data/lessons.ts';
import type { AccountCache, AccountSnapshot, LearningRepository, PendingAttempt } from '../types/backend.ts';
import type { LearningProgress, Lesson, LessonAnswers, LessonResult, Unit } from '../types/learning.ts';
import { BackendRejectedError } from './backendErrors.ts';
import { decodeSnapshot, decodeUnit, object } from './backendDecoders.ts';
import { completeLesson, createProgress, lessonForAnswers } from './learningProgress.ts';

export type LearningStorage = { getItem:(key:string)=>Promise<string|null>; setItem:(key:string,value:string)=>Promise<void> };
export const accountKey = (id:string) => `arca.account.${id}.v1`;
export type AccountState = { unit:Unit; progress:LearningProgress; profile:AccountSnapshot['profile']; guestImported:boolean; pending:number; offline:boolean; rejected:number };
function emptyCache(userId:string): AccountCache {
  return {version:1,userId,unit:initialUnit,pending:[],rejected:[],snapshot:{progress:createProgress(),guestImported:false,
    profile:{id:userId,display_name:'Sua conta',username:'estudante',avatar_key:'learner',avatar_url:null,xp_total:0,current_streak:0,longest_streak:0,last_activity_date:null,created_at:new Date(0).toISOString(),updated_at:new Date(0).toISOString()}}};
}
export function parseAccountCache(raw:string,userId:string): AccountCache {
  const data:unknown = JSON.parse(raw);
  if (!object(data) || data.version !== 1 || data.userId !== userId || !object(data.unit) || !Array.isArray(data.unit.lessons)
    || !object(data.snapshot) || !object(data.snapshot.progress) || !Array.isArray(data.pending) || !Array.isArray(data.rejected)) throw new Error('Cache da conta inválido.');
  const rows:Record<string,unknown>[] = data.unit.lessons.map(lesson => {
    if (!object(lesson) || !Array.isArray(lesson.questions)) throw new Error('Conteúdo local inválido.');
    return { ...lesson,unit_id:lesson.unitId };
  });
  const questions = rows.flatMap(row => (row.questions as unknown[]).map(question => {
    if (!object(question)) throw new Error('Exercício local inválido.');
    const {id,type,prompt,explanation,...content} = question;
    return {id,type,prompt,explanation,content,lesson_id:row.id};
  }));
  const unit = combineUnits(journeyUnits(data.unit as Unit).map(header => decodeUnit(header, rows.filter(row => row.unit_id === header.id), questions)));
  const snapshot = decodeSnapshot({unitId:unit.id,xp:data.snapshot.progress.xp,
    completedLessonIds:data.snapshot.progress.completedLessonIds,lastResult:data.snapshot.progress.lastResult,
    profile:data.snapshot.profile,guestImported:data.snapshot.guestImported},userId,unit);
  const parseAttempts = (values:unknown[]):PendingAttempt[] => values.map(value => {
    if (!object(value) || typeof value.id !== 'string' || !value.id || typeof value.lessonId !== 'string'
      || !object(value.answers) || typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt))) throw new Error('Tentativa local inválida.');
    const lesson = unit.lessons.find(item=>item.id === value.lessonId);
    if (!lesson) throw new Error('Respostas locais inválidas.');
    lessonForAnswers(lesson, value.answers as LessonAnswers);
    return value as PendingAttempt;
  });
  const pending = parseAttempts(data.pending);
  const rejected = parseAttempts(data.rejected);
  if (new Set([...pending,...rejected].map(a=>a.id)).size !== pending.length + rejected.length) throw new Error('Tentativas duplicadas.');
  return {version:1,userId,unit,snapshot,pending,rejected};
}
function projected(cache:AccountCache): LearningProgress {
  return cache.pending.reduce((progress,attempt) => {
    const lesson = cache.unit.lessons.find(item=>item.id === attempt.lessonId);
    if (!lesson) throw new Error('Lição local indisponível.');
    return completeLesson(progress,lessonForAnswers(lesson, attempt.answers),attempt.answers,attempt.id,attempt.createdAt,cache.unit,true);
  },cache.snapshot.progress);
}
export function createAccountLearningStore(storage:LearningStorage,userId:string,repository:LearningRepository) {
  let cache:AccountCache|null = null;
  let offline = false;
  let queue:Promise<unknown> = Promise.resolve();
  const results = new Map<string,LessonResult>();
  function serial<T>(operation:()=>Promise<T>):Promise<T> {
    const pending = queue.then(operation);
    queue = pending.catch(()=>undefined);
    return pending;
  }
  function current():AccountCache { if (!cache) throw new Error('A conta ainda não foi carregada.'); return cache; }
  function state():AccountState {
    const data = current();
    return {unit:data.unit,progress:projected(data),profile:data.snapshot.profile,guestImported:data.snapshot.guestImported,
      pending:data.pending.length,rejected:data.rejected.length,offline};
  }
  async function commit(next:AccountCache) { await storage.setItem(accountKey(userId),JSON.stringify(next)); cache = next; }
  async function flush() {
    while (current().pending.length) {
      const attempt = current().pending[0]!;
      let response:Awaited<ReturnType<LearningRepository['complete']>>;
      try { response = await repository.complete(attempt); }
      catch (error) {
        if (!(error instanceof BackendRejectedError)) { offline = true; return; }
        const data = current();
        await commit({...data,pending:data.pending.slice(1),rejected:[...data.rejected,attempt]});
        continue;
      }
      const data = current();
      // Remove the outbox item only after persisting the server receipt/snapshot.
      await commit({...data,snapshot:{...response.snapshot,progress:{...response.snapshot.progress,lastResult:response.result}},pending:data.pending.slice(1)});
      results.set(attempt.id,response.result);
    }
    try {
      const snapshot = await repository.loadSnapshot();
      await commit({...current(),snapshot});
      offline = false;
    } catch (error) { if (error instanceof BackendRejectedError) throw error; offline = true; }
  }
  return {
    load: () => serial(async () => {
      const raw = await storage.getItem(accountKey(userId));
      let corrupt:string|null = null;
      if (raw) { try { cache = parseAccountCache(raw,userId); } catch { corrupt = raw; cache = emptyCache(userId); } }
      else cache = emptyCache(userId);
      try {
        const unit = await repository.loadUnit();
        const snapshot = await repository.loadSnapshot();
        if (corrupt) await storage.setItem(`${accountKey(userId)}.backup.${Date.now()}`,corrupt);
        await commit({...current(),unit,snapshot});
        offline = false;
      } catch {
        if (corrupt) throw new Error('Não foi possível recuperar o cache da conta. Os dados originais continuam guardados.');
        offline = true;
        if (!raw) await commit(current());
      }
      if (!offline) await flush();
      return state();
    }),
    sync: () => serial(async () => { await flush(); return state(); }),
    getState:state,
    complete: (lesson:Lesson,answers:LessonAnswers,attemptId:string) => serial(async () => {
      const data = current();
      if (results.has(attemptId)) return {state:state(),result:results.get(attemptId)!};
      if (data.snapshot.progress.lastResult?.attemptId === attemptId) return {state:state(),result:data.snapshot.progress.lastResult};
      if (data.rejected.some(attempt=>attempt.id === attemptId)) throw new BackendRejectedError('answer_invalid');
      const existing = data.pending.find(attempt=>attempt.id === attemptId);
      if (existing && (existing.lessonId !== lesson.id || JSON.stringify(existing.answers) !== JSON.stringify(answers))) throw new BackendRejectedError('attempt_conflict');
      if (!existing) {
        completeLesson(projected(data),lesson,answers,attemptId,new Date().toISOString(),data.unit);
        const attempt:PendingAttempt = {id:attemptId,lessonId:lesson.id,answers:JSON.parse(JSON.stringify(answers)) as LessonAnswers,createdAt:new Date().toISOString()};
        await commit({...data,pending:[...data.pending,attempt]});
      }
      await flush();
      const after = current();
      if (after.rejected.some(attempt=>attempt.id === attemptId)) throw new BackendRejectedError('answer_invalid');
      const result = results.get(attemptId) ?? projected(after).lastResult;
      if (!result || result.attemptId !== attemptId) throw new Error('Resultado indisponível.');
      return {state:state(),result};
    }),
    importGuest: (sourceId:string,progress:LearningProgress) => serial(async () => {
      await flush();
      if (offline || current().pending.length) throw new Error('Conecte-se para salvar o progresso de visitante.');
      const snapshot = await repository.importGuest(sourceId,progress);
      await commit({...current(),snapshot});
      return state();
    }),
    updateProfile: (identity:Parameters<LearningRepository['updateProfile']>[0]) => serial(async () => {
      await repository.updateProfile(identity);
      const snapshot = await repository.loadSnapshot();
      const data = current();
      await commit({...data,snapshot});
      return state();
    }),
    start:(lessonId:string) => repository.start(lessonId).catch(()=>undefined),
    updateAvatar: (key:string) => serial(async () => {
      const avatar = await repository.updateAvatar(key);
      const data = current();
      await commit({...data,snapshot:{...data.snapshot,profile:{...data.snapshot.profile,...avatar}}});
      return state();
    }),
  };
}
export async function guestSource(storage:LearningStorage):Promise<string> {
  const key = 'arca.guest.source.v1';
  const old = await storage.getItem(key);
  if (old) return old;
  const id = `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await storage.setItem(key,id);
  return id;
}
