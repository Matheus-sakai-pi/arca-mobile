import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { CalendarDays, CheckCircle2, History, RotateCcw, Play } from '@/components/icons';
import { useStudy } from '@/providers/StudyProvider';
import { useLearning } from '@/providers/LearningProvider';
import { usePreferences } from '@/providers/PreferencesProvider';
import { dailyExercises, dueReviews, localDay } from '@/lib/studyStore';
import { lessonStatus } from '@/lib/learningProgress';
import { AppText } from '@/components/common/AppText';
import { Notice } from '@/components/common/Notice';
import { ProgressBar } from './ProgressBar';
import { colors, fonts, surfaces } from '@/constants/theme';
import { useEffect, useState } from 'react';
export function StudySummary() {
  const {state,draft,error}=useStudy();
  const {progress,unit}=useLearning();
  const {dailyGoal}=usePreferences();
  const [day,setDay]=useState(localDay);
  useEffect(()=>{const timer=setInterval(()=>setDay(localDay()),60000);return()=>clearInterval(timer);},[]);
  if(!state || !progress) return error ? <Notice tone="error" message={error} /> : null;
  const total=dailyExercises(state.history,day);
  const due=dueReviews(state.history,unit,progress.completedLessonIds);
  const resume=unit.lessons.filter(lesson=>lessonStatus(progress,lesson.id,null,unit) !== 'locked' && draft(lesson)).sort((a,b)=>Date.parse(state.drafts[b.id]!.updatedAt)-Date.parse(state.drafts[a.id]!.updatedAt))[0];
  return <View testID="study-summary" style={styles.summary}>
    <View style={styles.goal}>
      <View style={styles.goalHeading}><AppText style={styles.goalTitle}>Meta de hoje</AppText><View style={styles.goalCount} accessibilityLabel={`${total} de ${dailyGoal} exercícios concluídos hoje`}>{total >= dailyGoal ? <CheckCircle2 size={16} color={colors.success} /> : null}<AppText variant="small" style={styles.count}>{total}/{dailyGoal}</AppText><AppText variant="small" color={colors.muted}>exercícios</AppText></View></View>
      <ProgressBar compact value={Math.min(100,total/dailyGoal*100)} label="Meta diária" />
    </View>
    {resume ? <Pressable testID="resume-study" accessibilityRole="button" accessibilityLabel={`Retomar: ${resume.title}`} onPress={()=>router.push({pathname:'/lesson/[id]',params:{id:resume.id}})} style={({pressed})=>[styles.resume,pressed && styles.pressed]}>
      <View style={styles.resumeText}><AppText variant="label" color={colors.muted}>Continuar estudando</AppText><AppText variant="h3" style={styles.lesson}>{resume.title}</AppText></View><View style={styles.play}><Play size={22} color={colors.surface} fill={colors.surface} /></View>
    </Pressable> : null}
    <View style={styles.actions}>
      <Pressable accessibilityRole="button" accessibilityLabel={due.length ? `Revisão · ${due.length}` : 'Revisar'} onPress={()=>router.push('/study/review')} style={({pressed})=>[styles.action,pressed && styles.pressed]}><RotateCcw size={19} color={colors.tealInk} /><AppText style={styles.actionText}>Revisão</AppText>{due.length ? <View style={styles.badge}><AppText variant="label" color={colors.tealInk}>{due.length}</AppText></View> : null}</Pressable>
      <View style={styles.divider} />
      <Pressable accessibilityRole="button" accessibilityLabel="Histórico" onPress={()=>router.push('/study/history')} style={({pressed})=>[styles.action,pressed && styles.pressed]}><History size={19} color={colors.muted} /><AppText style={styles.actionText}>Histórico</AppText></Pressable>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel="Meu resumo semanal" onPress={()=>router.push('/study/weekly')} style={({pressed})=>[styles.action,pressed && styles.pressed]}><CalendarDays size={19} color={colors.tealInk}/><AppText style={styles.actionText}>Meu resumo semanal</AppText></Pressable>
  </View>;
}

const styles=StyleSheet.create({
  summary:{gap:16,paddingVertical:8},
  goal:{gap:10},
  goalHeading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8,flexWrap:'wrap'},
  goalTitle:{fontFamily:fonts.bold},
  goalCount:{flexDirection:'row',alignItems:'center',gap:4},
  count:{fontFamily:fonts.bold},
  resume:{...surfaces.tactile,flexDirection:'row',alignItems:'center',gap:16,padding:16},
  resumeText:{flex:1,minWidth:0,gap:4},
  lesson:{fontSize:18,lineHeight:24},
  play:{width:48,height:48,borderRadius:24,backgroundColor:colors.primary,alignItems:'center',justifyContent:'center'},
  actions:{flexDirection:'row',alignItems:'center',borderTopWidth:1,borderBottomWidth:1,borderColor:colors.border},
  action:{flex:1,minHeight:52,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,paddingVertical:12,paddingHorizontal:4},
  actionText:{fontFamily:fonts.bold,fontSize:15,lineHeight:21,flexShrink:1},
  badge:{minWidth:22,minHeight:22,paddingHorizontal:5,borderRadius:11,backgroundColor:colors.tealSoft,alignItems:'center',justifyContent:'center'},
  divider:{width:1,height:20,backgroundColor:colors.border},
  pressed:{opacity:0.7},
});
