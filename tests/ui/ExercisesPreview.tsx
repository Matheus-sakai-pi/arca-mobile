import { useState } from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Screen } from '@/components/common/Screen';
import { QuestionRenderer } from '@/components/learning/QuestionRenderer';
import { initialUnit } from '@/data/lessons';
import { canVerify, evaluateQuestion } from '@/lib/questionEngine';
import type { Question, QuestionAnswer } from '@/types/learning';

const types=['odd_one_out','fix_sentence','before_after','sequence','classify','cause_effect','quote_character','spot_the_error','story_summary','content_card'] as const;
const exercises=types.map(type=>initialUnit.lessons.flatMap(lesson=>lesson.questions).find(q=>q.type === type)!);
function wrong(q:Question):QuestionAnswer {
  if(q.type === 'content_card')return 'seen';
  if(q.type === 'fix_sentence')return {...q.correctAnswer,replacement:q.options.find(option=>option.id !== q.correctAnswer.replacement)!.id};
  if(q.type === 'classify') { const key=q.options[0]!.id;return {...q.correctAnswer,[key]:q.categories.find(category=>category.id !== q.correctAnswer[key])!.id}; }
  if(typeof q.correctAnswer === 'string')return q.options.find(option=>option.id !== q.correctAnswer)!.id;
  throw new Error('Unexpected preview type');
}
// Isolated UI fixture: no account, XP, completion, audio or storage mutations.
export default function ExercisesPreview() {
  const [index,setIndex]=useState(0);
  const [answer,setAnswer]=useState<QuestionAnswer|null>(null);
  const [verified,setVerified]=useState(false);
  const q=exercises[index]!;
  return <Screen footer={<><AppText>{verified ? evaluateQuestion(q,answer) ? 'Correto!' : 'Quase!' : q.type}</AppText><Button title="Verificar" disabled={verified || !canVerify(q,answer)} onPress={()=>setVerified(true)} /><View style={{flexDirection:'row',gap:8}}><Button title="Exemplo incorreto" style={{flex:1,paddingHorizontal:8}} variant="quiet" onPress={()=>{setVerified(false);setAnswer(wrong(q));}} /><Button title="Exemplo correto" style={{flex:1,paddingHorizontal:8}} variant="quiet" onPress={()=>{setVerified(false);setAnswer(q.correctAnswer);}} /></View><Button title="Próximo exercício" onPress={()=>{setIndex((index+1)%exercises.length);setAnswer(null);setVerified(false);}} /></>}><QuestionRenderer key={q.id} question={q} answer={answer} verified={verified} onAnswer={setAnswer} /></Screen>;
}
