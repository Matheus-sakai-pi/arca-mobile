import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, RotateCcw } from 'lucide-react-native';
import { useStudy } from '@/providers/StudyProvider';
import { useLearning } from '@/providers/LearningProvider';
import { dueReviews, reviewSchedule } from '@/lib/studyStore';
import { Screen } from '@/components/common/Screen';
import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { IconButton } from '@/components/common/IconButton';
import { EmptyState, LoadingState } from '@/components/common/States';
import { Notice } from '@/components/common/Notice';
import { colors, spacing } from '@/constants/theme';
import { VisualArtwork } from '@/components/animation/VisualArtwork';
export default function Review() {
  const {state,loading,error}=useStudy();
  const {unit,progress}=useLearning();
  if(loading || !progress) return <LoadingState />;
  const completed=unit.lessons.filter(lesson=>progress.completedLessonIds.includes(lesson.id));
  const due=dueReviews(state?.history ?? [],unit,progress.completedLessonIds);
  const ordered=[...due.map(item=>item.lesson),...completed.filter(lesson=>!due.some(item=>item.lesson.id === lesson.id))];
  return <Screen><IconButton icon={ArrowLeft} label="Voltar" onPress={()=>router.canGoBack() ? router.back() : router.replace('/(tabs)/home')} /><AppText accessibilityRole="header" variant="h2">Revisão</AppText>{error ? <Notice tone="error" message={error} /> : null}{completed.length ? <View style={styles.intro}><VisualArtwork name="review" size={80} /><AppText style={styles.introText} color={colors.muted}>{due.length ? `${due.length} lições para revisar hoje` : 'Revisões em dia'}</AppText></View> : <EmptyState icon={RotateCcw} artwork="review" title="Um passo de cada vez" message="Conclua sua primeira lição para começar." />}{ordered.map(lesson=>{
    const schedule=reviewSchedule(state?.history ?? [],lesson.id);
    const overdue=due.some(item=>item.lesson.id === lesson.id);
    return <View key={lesson.id} style={styles.item}><AppText variant="h3">{lesson.title}</AppText><AppText variant="small" color={colors.muted}>{overdue ? 'Revisão de hoje' : schedule ? `Próxima revisão: ${new Date(schedule.dueAt).toLocaleDateString('pt-BR')}` : 'Disponível para revisar'}</AppText><Button title="Revisar lição" icon={RotateCcw} variant="secondary" onPress={()=>router.push({pathname:'/lesson/[id]',params:{id:lesson.id}})} /></View>;
  })}</Screen>;
}
const styles=StyleSheet.create({intro:{flexDirection:'row',alignItems:'center',gap:spacing.md},introText:{flex:1,minWidth:0},item:{gap:spacing.xs,padding:spacing.md,borderRadius:8,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border}});
