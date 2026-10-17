import { integer, object } from './backendDecoders.ts';
import { isValidQuestion } from './questionEngine.ts';
import type { Question } from '../types/learning.ts';
export const CHALLENGE_SIZE=10;
export type Challenge={id:string;sender:string;recipient:string;total:5|10;status:'pending'|'accepted'|'declined'|'cancelled'|'expired';createdAt:string;expiresAt:string;friendName:string;avatarKey:string;myScore:number|null;theirScore:number|null;friendFinished:boolean};
export type ChallengePage={owner:string;items:Challenge[]};
export function createChallengeKey(){return `invite-${Date.now()}-${Math.random().toString(36).slice(2)}`;}
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
const score=(value:unknown,total:number)=>value===null||integer(value)&&value<=total;
export function decodeChallenges(value:unknown,owner:string):ChallengePage {
  if(!object(value)||value.owner!==owner||!Array.isArray(value.items)||value.items.length>100)throw new Error('Lista de desafios inválida.');
  const items=value.items.map(item=>{
    if(!object(item))throw new Error('Desafio inválido.');
    const total=item.total===undefined?5:item.total;
    if((total!==5&&total!==10)||!uuid(item.id)||!uuid(item.sender)||!uuid(item.recipient)||![item.sender,item.recipient].includes(owner)||item.sender===item.recipient||!['pending','accepted','declined','cancelled','expired'].includes(String(item.status))||typeof item.friendName!=='string'||typeof item.avatarKey!=='string'||!Number.isFinite(Date.parse(String(item.createdAt)))||!Number.isFinite(Date.parse(String(item.expiresAt)))||!score(item.myScore,total)||!score(item.theirScore,total)||typeof item.friendFinished!=='boolean'||(item.theirScore!==null&&(item.myScore===null||!item.friendFinished)))throw new Error('Desafio inválido.');
    return {...item,total} as Challenge;
  });
  if(new Set(items.map(item=>item.id)).size!==items.length)throw new Error('Desafios duplicados.');
  return {owner,items};
}
export function decodeChallengePlay(value:unknown,owner:string,id:string):Question[] {
  if(!object(value)||value.owner!==owner||value.id!==id||!Array.isArray(value.questions)||![5,10].includes(value.questions.length))throw new Error('Perguntas do desafio inválidas.');
  const questions=value.questions.map(row=>{
    if(!object(row)||!object(row.content)||'correctAnswer' in row.content||!Array.isArray(row.content.options)||!object(row.content.options[0]))throw new Error('Pergunta do desafio inválida.');
    const content=row.content;
    const ids=row.content.options.map(option=>{
      if(!object(option)||typeof option.id!=='string'||typeof option.label!=='string')throw new Error('Alternativas do desafio inválidas.');
      return option.id;
    });
    const relatedIds=(key:string)=>{
      const entries=content[key];
      if(!Array.isArray(entries)||!entries.length||entries.some(entry=>!object(entry)||typeof entry.id!=='string'||typeof entry.label!=='string'))throw new Error('Pergunta do desafio inválida.');
      return entries.map(entry=>entry.id as string);
    };
    // The renderer needs a structurally valid placeholder; only the server knows and grades the real solution.
    let placeholder:unknown=ids[0];
    if(row.type==='ordering')placeholder=ids;
    if(row.type==='multi_select')placeholder=ids.slice(0,2);
    if(row.type==='classify')placeholder=Object.fromEntries(ids.map(id=>[id,relatedIds('categories')[0]]));
    if(row.type==='matching'){const right=relatedIds('rightOptions');placeholder=Object.fromEntries(ids.map((id,index)=>[id,right[index]]));}
    if(row.type==='fix_sentence')placeholder={fragment:relatedIds('fragments')[0],replacement:ids[0]};
    const question={...row.content,id:row.id,type:row.type,prompt:row.prompt,explanation:'Resposta avaliada no servidor.',correctAnswer:placeholder} as Question;
    if(['content_card','story_summary'].includes(question.type)||!isValidQuestion(question))throw new Error('Pergunta do desafio inválida.');
    return question;
  });
  if(new Set(questions.map(q=>q.id)).size!==questions.length)throw new Error('Perguntas duplicadas.');
  return questions;
}
export function challengeError(error:{code?:string;message?:string}) {
  if(error.code==='PGRST202'||error.code==='42883')return 'Os desafios ainda precisam ser ativados no Supabase.';
  const message=error.message??'';
  if(/challenge_already_open/.test(message))return 'Você já tem um desafio em aberto com esse amigo. Atualize a lista.';
  if(/challenge_friend_required/.test(message))return 'É preciso ter uma amizade aceita para desafiar esta pessoa.';
  if(/challenge_limit/.test(message))return 'Limite de convites atingido. Aguarde antes de enviar outro.';
  if(/challenge_expired/.test(message))return 'Este desafio expirou. O prazo é de 7 dias.';
  if(/challenge_finished/.test(message))return 'Sua tentativa já foi recebida. Volte à lista para ver o resultado.';
  if(/challenge_content_missing/.test(message))return 'Ainda não há dez perguntas disponíveis em comum.';
  if(/challenge_not_accepted/.test(message))return 'O convite precisa ser aceito antes de começar.';
  if(/challenge_not_allowed|challenge_missing/.test(message))return 'Este desafio não está disponível para esta ação. Atualize a lista.';
  return 'Não foi possível concluir. Confira sua conexão e tente novamente.';
}
