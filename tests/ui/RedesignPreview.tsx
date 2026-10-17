import { useState } from 'react';
import { View } from 'react-native';
import { ArrowRight, X } from 'lucide-react-native';
import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { IconButton } from '@/components/common/IconButton';
import { Screen } from '@/components/common/Screen';
import { QuestionRenderer } from '@/components/learning/QuestionRenderer';
import { initialUnit } from '@/data/lessons';
import { canVerify, evaluateQuestion } from '@/lib/questionEngine';
import { ProgressBar } from '@/components/learning/ProgressBar';
import type { QuestionAnswer } from '@/types/learning';
const questions = initialUnit.lessons.flatMap(lesson => lesson.questions).filter(question => question.type !== 'content_card');
const types = [...new Set(questions.map(question => question.type))];
const examples = types.map(type => questions.filter(question => question.type === type).sort((a,b) => JSON.stringify(b).length - JSON.stringify(a).length)[0]!);

// Visual QA only: no profile, XP, storage, audio or backend writes.
export default function RedesignPreview() {
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<QuestionAnswer | null>(null);
  const [verified, setVerified] = useState(false);
  const question = examples[index]!;
  return <Screen scene="valley" resetScrollKey={question.id} footer={<>
    {verified ? <AppText>{evaluateQuestion(question, answer) ? 'Correto!' : 'Quase!'} {question.explanation}</AppText> : null}
    <Button icon={ArrowRight} title="Verificar" disabled={verified || !canVerify(question, answer)} onPress={() => setVerified(true)} />
    <Button title="Resposta de teste" variant="quiet" onPress={() => setAnswer(question.correctAnswer)} />
    <Button title="Próximo exercício" onPress={() => { setIndex((index + 1) % examples.length); setAnswer(null); setVerified(false); }} />
  </>}><View style={{ flexDirection: 'row', gap: 16, alignItems: 'center', minHeight: 112 }}><IconButton icon={X} label="Reiniciar teste" onPress={() => { setAnswer(null); setVerified(false); }} /><View style={{ flex: 1 }}><ProgressBar value={(index+1)/examples.length*100} label="Progresso" /><AppText>{question.type}</AppText></View></View><View style={{ padding: 24, backgroundColor: 'white', borderRadius: 28 }}><QuestionRenderer question={question} answer={answer} verified={verified} onAnswer={setAnswer} /></View></Screen>;
}
