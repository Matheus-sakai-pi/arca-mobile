import { useState } from 'react';
import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Screen } from '@/components/common/Screen';
import { QuestionRenderer } from '@/components/learning/QuestionRenderer';
import { initialUnit, previousLessonIds } from '@/data/lessons';
import { canVerify, evaluateQuestion } from '@/lib/questionEngine';
import type { QuestionAnswer } from '@/types/learning';

const types = ['multiple_choice','fill_blank','matching','ordering','true_false','sequence','before_after'] as const;
const added = initialUnit.lessons.filter(lesson => !previousLessonIds.includes(lesson.id)).flatMap(lesson => lesson.questions);
const exercises = types.map(type => added.filter(question => question.type === type).sort((a,b) => JSON.stringify(b).length - JSON.stringify(a).length)[0]!);

// Isolated responsive fixture. No profile, storage, XP, audio or completion writes.
export default function CurriculumPreview() {
  const [index,setIndex] = useState(0);
  const [answer,setAnswer] = useState<QuestionAnswer | null>(null);
  const [verified,setVerified] = useState(false);
  const question = exercises[index]!;
  return <Screen resetScrollKey={question.id} footer={<>
    <AppText>{verified ? evaluateQuestion(question,answer) ? 'Correto!' : 'Quase!' : question.type}</AppText>
    {verified ? <AppText variant="small">{question.explanation}</AppText> : null}
    <Button title="Verificar" disabled={verified || !canVerify(question,answer)} onPress={() => setVerified(true)} />
    <Button title="Preencher resposta" variant="quiet" onPress={() => setAnswer(question.correctAnswer)} />
    <Button title="Próximo exercício" onPress={() => { setIndex((index+1)%exercises.length); setAnswer(null); setVerified(false); }} />
  </>}><QuestionRenderer question={question} answer={answer} verified={verified} onAnswer={setAnswer} /></Screen>;
}
