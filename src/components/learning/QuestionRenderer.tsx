import type { ComponentType } from 'react';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { useMotionPreference } from '@/hooks/useMotionPreference';
import type { Question } from '@/types/learning';
import { MultipleChoiceQuestion } from './questions/MultipleChoiceQuestion';
import { FillBlankQuestion } from './questions/FillBlankQuestion';
import { MatchingQuestion } from './questions/MatchingQuestion';
import { OrderingQuestion } from './questions/OrderingQuestion';
import { TrueFalseQuestion } from './questions/TrueFalseQuestion';
import { MultiSelectQuestion } from './questions/MultiSelectQuestion';
import { WhoAmIQuestion } from './questions/WhoAmIQuestion';
import type { ExerciseProps } from './questions/types';
import { ContentCardQuestion } from './questions/ContentCardQuestion';
import { OddOneOutQuestion } from './questions/OddOneOutQuestion';
import { FixSentenceQuestion } from './questions/FixSentenceQuestion';
import { BeforeAfterQuestion } from './questions/BeforeAfterQuestion';
import { SequenceQuestion } from './questions/SequenceQuestion';
import { ClassifyQuestion } from './questions/ClassifyQuestion';
import { CauseEffectQuestion } from './questions/CauseEffectQuestion';
import { QuoteCharacterQuestion } from './questions/QuoteCharacterQuestion';
import { SpotTheErrorQuestion } from './questions/SpotTheErrorQuestion';
import { StorySummaryQuestion } from './questions/StorySummaryQuestion';

const renderers: { [Type in Question['type']]: ComponentType<ExerciseProps<Extract<Question, { type: Type }>>> } = {
  content_card: ContentCardQuestion,
  multiple_choice: MultipleChoiceQuestion,
  fill_blank: FillBlankQuestion,
  matching: MatchingQuestion,
  ordering: OrderingQuestion,
  true_false: TrueFalseQuestion,
  multi_select: MultiSelectQuestion,
  who_am_i: WhoAmIQuestion,
  odd_one_out: OddOneOutQuestion,
  fix_sentence: FixSentenceQuestion,
  before_after: BeforeAfterQuestion,
  sequence: SequenceQuestion,
  classify: ClassifyQuestion,
  cause_effect: CauseEffectQuestion,
  quote_character: QuoteCharacterQuestion,
  spot_the_error: SpotTheErrorQuestion,
  story_summary: StorySummaryQuestion,
};
export const questionInstructions: Record<Question['type'], string> = {
  content_card: 'Leia com calma',
  odd_one_out: 'Encontre o intruso', fix_sentence: 'Corrija a frase', before_after: 'O que veio primeiro?', sequence: 'Complete a sequência', classify: 'Separe os grupos', cause_effect: 'Ligue causa e consequência', quote_character: 'De quem é esta história?', spot_the_error: 'Encontre o erro', story_summary: 'Reúna a ideia principal',
  multiple_choice: 'Escolha a resposta', fill_blank: 'Complete a frase', matching: 'Encontre os pares', ordering: 'Monte a sequência', true_false: 'Verdadeiro ou falso?', multi_select: 'Selecione todas as corretas', who_am_i: 'Descubra o personagem',
};
export function QuestionRenderer(props: ExerciseProps) {
  const reduced=useMotionPreference();
  // Registration is discriminant-checked; the indexed lookup erases that correlation.
  const Renderer = renderers[props.question.type] as ComponentType<ExerciseProps>;
  return <Animated.View key={props.question.id} entering={FadeInDown.duration(180).reduceMotion(reduced ? ReduceMotion.Always : ReduceMotion.System)}><Renderer {...props} /></Animated.View>;
}
