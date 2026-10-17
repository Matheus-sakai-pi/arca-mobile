import { useCallback, useRef, useState } from 'react';
import { BackHandler, Modal, ScrollView, StyleSheet, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, ArrowRight, Send, Swords } from 'lucide-react-native';
import { Screen } from '@/components/common/Screen';
import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { IconButton } from '@/components/common/IconButton';
import { Notice } from '@/components/common/Notice';
import { LoadingState } from '@/components/common/States';
import { ProgressBar } from '@/components/learning/ProgressBar';
import { QuestionRenderer, questionInstructions } from '@/components/learning/QuestionRenderer';
import { useAuth } from '@/hooks/useAuth';
import { challengesRepository } from '@/services/challenges';
import { accountStorage } from '@/lib/accountStorage';
import type { LessonAnswers, Question, QuestionAnswer } from '@/types/learning';
import { canVerify } from '@/lib/questionEngine';
import { object } from '@/lib/backendDecoders';
import { colors } from '@/constants/theme';
import { VisualArtwork } from '@/components/animation/VisualArtwork';

export default function ChallengePlay(){const {id}=useLocalSearchParams<{id:string}>();const {session}=useAuth();return session&&typeof id==='string'?<Play key={`${session.user.id}:${id}`} owner={session.user.id} id={id}/>:<Screen><AppText>Entre na sua conta para jogar.</AppText><Button title="Voltar" onPress={()=>router.replace('/challenges')}/></Screen>;}
function Play({owner,id}:{owner:string;id:string}){
  const [questions,setQuestions]=useState<Question[]|null>(null),[answers,setAnswers]=useState<LessonAnswers>({}),[answer,setAnswer]=useState<QuestionAnswer|null>(null);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[received,setReceived]=useState(false),[leaving,setLeaving]=useState(false);
  const lock=useRef(false),epoch=useRef(0),controller=useRef<AbortController|null>(null);
  const key=`arca.challenges.${owner}.${id}`;
  const load=useCallback(async()=>{
    const version=++epoch.current;controller.current?.abort();const request=new AbortController();controller.current=request;setLoading(true);setError(null);
    try{const next=await challengesRepository(owner).play(id,request.signal);const raw=await accountStorage.getItem(`arca.challenges.${owner}.${id}`);let restored:LessonAnswers={};
      if(raw){const draft:unknown=JSON.parse(raw);if(object(draft)&&draft.fingerprint===JSON.stringify(next)&&object(draft.answers)){const saved=draft.answers;const n=Object.keys(saved).length;if(n<=next.length&&next.every((q,index)=>index<n?canVerify(q,saved[q.id]):!Object.hasOwn(saved,q.id)))restored=saved as LessonAnswers;}}
      if(version===epoch.current){setQuestions(next);setAnswers(restored);setAnswer(null);}
    }catch(cause){if(version===epoch.current)setError(cause instanceof Error?cause.message:'Não foi possível abrir o desafio.');}
    finally{if(version===epoch.current)setLoading(false);}
  },[id,owner]);
  useFocusEffect(useCallback(()=>{void load();const listener=BackHandler.addEventListener('hardwareBackPress',()=>{if(!lock.current)setLeaving(true);return true;});return()=>{epoch.current++;controller.current?.abort();listener.remove();};},[load]));
  const index=Object.keys(answers).length,total=questions?.length??10,question=questions?.[index];
  async function advance(){
    if(lock.current||!question||!canVerify(question,answer)||answer===null)return;
    lock.current=true;setBusy(true);setError(null);const version=epoch.current;
    const next={...answers,[question.id]:answer};
    try{await accountStorage.setItem(key,JSON.stringify({fingerprint:JSON.stringify(questions),answers:next}));if(version===epoch.current){setAnswers(next);setAnswer(null);}}
    catch{if(version===epoch.current)setError('Não foi possível guardar sua resposta neste aparelho. Tente novamente.');}
    finally{lock.current=false;if(version===epoch.current)setBusy(false);}
  }
  async function submit(){
    if(lock.current||!questions||index!==total)return;lock.current=true;setBusy(true);setError(null);const version=epoch.current;const request=new AbortController();controller.current=request;
    try{const page=await challengesRepository(owner).submit(id,answers,request.signal);const item=page.items.find(item=>item.id===id);if(item?.myScore===null||!item)throw new Error('Não foi possível confirmar seu resultado.');if(version===epoch.current){setReceived(true);await accountStorage.setItem(key,'{}').catch(()=>undefined);}}
    catch(cause){if(version===epoch.current)setError(cause instanceof Error?cause.message:'Não foi possível enviar. Suas respostas continuam guardadas.');}
    finally{lock.current=false;if(version===epoch.current)setBusy(false);}
  }
  if(loading)return <LoadingState message="Preparando desafio…"/>;
  return <><Screen resetScrollKey={String(index)} footer={questions&&!received?<Button title={index===total?'Enviar respostas':'Próxima pergunta'} icon={index===total?Send:ArrowRight} loading={busy} disabled={index!==total&&(!question||!canVerify(question,answer))} onPress={()=>void(index===total?submit():advance())}/>:undefined}>
    <View style={styles.heading}><IconButton icon={ArrowLeft} label="Sair do desafio" disabled={busy} onPress={()=>setLeaving(true)}/><AppText accessibilityRole="header" variant="h2" style={styles.grow}>Desafio entre amigos</AppText></View>
    {received || index === 0 ? <VisualArtwork name="challenge" size={received ? 112 : 80} /> : null}
    {error?<><Notice tone="error" message={error}/>{!questions?<Button title="Tentar novamente" onPress={()=>void load()}/>:null}</>:null}
    {received?<><Swords size={40} color={colors.tealInk}/><AppText accessibilityRole="header" variant="h2">Respostas recebidas</AppText><AppText>Confira o resultado na lista. A comparação aparece quando os dois terminam.</AppText><Button title="Ver resultado" icon={ArrowRight} onPress={()=>router.replace('/challenges')}/></>:questions?<><ProgressBar value={index/total*100} label="Progresso do desafio"/><AppText variant="small" color={colors.muted}>{index===total?`${total} perguntas respondidas`:`Pergunta ${index+1}/${total}`}</AppText>{question?<View style={styles.exercise}><AppText variant="small" color={colors.muted}>{questionInstructions[question.type]}</AppText><QuestionRenderer key={question.id} question={question} answer={answer} verified={false} onAnswer={value=>{if(!busy)setAnswer(value);}}/></View>:<><AppText variant="h3">Tudo pronto</AppText><AppText>Envie suas {total} respostas para registrar a tentativa. Não é possível alterá-las depois do envio.</AppText></>}</>:<Button title="Voltar aos desafios" onPress={()=>router.replace('/challenges')}/>}
  </Screen><Modal visible={leaving} transparent animationType="fade" onRequestClose={()=>setLeaving(false)}><ScrollView style={styles.overlay} contentContainerStyle={styles.overlayContent}><View style={styles.dialog} accessibilityViewIsModal><AppText variant="h3">Voltar aos desafios?</AppText><AppText>As respostas já confirmadas ficam neste aparelho. Você pode continuar antes de o prazo terminar.</AppText><Button title="Continuar jogando" onPress={()=>setLeaving(false)}/><Button title="Salvar e sair" variant="secondary" onPress={()=>router.replace('/challenges')}/></View></ScrollView></Modal></>;
}
const styles=StyleSheet.create({heading:{flexDirection:'row',alignItems:'center',gap:8},grow:{flex:1,minWidth:0},exercise:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:8,padding:16},overlay:{flex:1,backgroundColor:'rgba(34,33,42,0.45)'},overlayContent:{flexGrow:1,alignItems:'center',justifyContent:'center',padding:16},dialog:{width:'100%',maxWidth:420,backgroundColor:colors.surface,borderRadius:8,padding:20,gap:16}});
