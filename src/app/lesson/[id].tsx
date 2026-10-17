import { useLocalSearchParams } from 'expo-router';
import { LockKeyhole, SearchX } from 'lucide-react-native';
import { Screen } from '@/components/common/Screen';
import { Button } from '@/components/common/Button';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States';
import { LearningGate } from '@/components/learning/LearningGate';
import { LessonPlayer } from '@/components/learning/LessonPlayer';
import { EnergyGate } from '@/components/learning/EnergyGate';
import { lessonStatus } from '@/lib/learningProgress';
import { returnToTrail } from '@/lib/learningNavigation';
import { useLearning } from '@/providers/LearningProvider';
import { useStudy } from '@/providers/StudyProvider';

export default function LessonScreen() {
  return <LearningGate><LessonContent /></LearningGate>;
}
function LessonContent() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const { progress, unit } = useLearning();
  const study=useStudy();
  const lesson = typeof id === 'string' ? unit.lessons.find(item=>item.id === id) : undefined;
  if (!progress) return null;
  const locked = lesson && lessonStatus(progress, lesson.id,null,unit) === 'locked';
  if (!lesson || locked) return <Screen footer={<Button title="Voltar à trilha" onPress={returnToTrail} />}><EmptyState icon={locked ? LockKeyhole : SearchX} title={locked ? 'Um passo de cada vez' : 'Lição não encontrada'} message={locked ? 'Conclua a lição anterior para liberar este passo.' : 'Esta lição não faz parte da sua unidade.'} /></Screen>;
  if(study.loading) return <LoadingState message="Preparando sua tentativa..." />;
  if(!study.state) return <ErrorState message={study.error ?? 'Não foi possível preparar a lição.'} onRetry={study.retry} />;
  return <EnergyGate key={lesson.id} lesson={lesson} draft={study.draft(lesson)}>{draft => <LessonPlayer key={draft.attemptId} lesson={lesson} draft={draft} />}</EnergyGate>;
}
