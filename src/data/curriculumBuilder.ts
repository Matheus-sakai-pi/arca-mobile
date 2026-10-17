import type { Lesson, Question, QuestionOption, Unit } from '../types/learning.ts';
import { practiceExercises } from './practiceExercises.ts';

type Fact = readonly [prompt: string, answer: string, distractor: string, other: string, explanation: string];
export type Topic = {
  id: string;
  title: string;
  reference: string;
  quiz: Fact;
  gap: Fact;
  pairs: readonly [readonly [string, string], readonly [string, string], readonly [string, string]];
  steps: readonly [string, string, string];
  check: readonly [statement: string, correct: boolean, explanation: string];
};

const options = (labels: readonly string[]): QuestionOption[] => labels.map((label, index) => ({ id: String(index + 1), label }));
function rotate<T>(values: readonly T[], offset: number): T[] {
  const split = offset % values.length;
  return [...values.slice(split), ...values.slice(0, split)];
}

// Explicit facts, associations and narrative order are authored per topic. Only
// exercise presentation and option shuffling are shared, never the answer content.
export function topicLesson(unitId: string, topic: Topic, index: number): Lesson {
  const id = (slot: number) => `${topic.id}-${slot}-v2`;
  const explanation = (text: string) => `${text} (${topic.reference})`;
  const fact = (value: Fact, slot: number) => {
    const labels = rotate(value.slice(1, 4), index + slot);
    return { id: id(slot), prompt: value[0], options: options(labels), correctAnswer: String(labels.indexOf(value[1]) + 1), explanation: explanation(value[4]) };
  };
  const left = options(topic.pairs.map(pair => pair[0]));
  const right = options(rotate(topic.pairs.map(pair => pair[1]), index + 1));
  const associations = Object.fromEntries(left.map((item, i) => [item.id, right.find(option => option.label === topic.pairs[i]![1])!.id]));
  const timeline = options(rotate(topic.steps, index % 2 + 1));
  let order: Question;
  const orderExplanation = explanation(`A sequência é: ${topic.steps.join(' → ')}.`);
  if (index % 3 === 0) {
    order = { id: id(4), type: 'ordering', prompt: 'Organize a sequência apresentada nesta lição.', options: timeline, correctAnswer: topic.steps.map(step => timeline.find(option => option.label === step)!.id), explanation: orderExplanation };
  } else if (index % 3 === 1) {
    const labels = rotate([topic.steps[0], topic.steps[2]], index);
    order = { id: id(4), type: 'before_after', prompt: 'Qual destes elementos aparece primeiro na sequência estudada?', options: options(labels), correctAnswer: String(labels.indexOf(topic.steps[0]) + 1), explanation: orderExplanation };
  } else {
    order = { id: id(4), type: 'sequence', prompt: 'Complete o momento que falta na sequência.', sequence: [topic.steps[0], null, topic.steps[2]], options: timeline, correctAnswer: timeline.find(option => option.label === topic.steps[1])!.id, explanation: orderExplanation };
  }
  return {
    id: topic.id, unitId, title: topic.title, description: `Passagens: ${topic.reference}.`,
    questions: [
      { ...fact(topic.quiz, 1), type: 'multiple_choice' },
      { ...fact(topic.gap, 2), type: 'fill_blank', prompt: 'Complete a frase.', sentence: topic.gap[0].replace('____', '{{blank}}') },
      { id: id(3), type: 'matching', prompt: 'Associe os elementos desta lição.', options: left, rightOptions: right, correctAnswer: associations, explanation: explanation(topic.pairs.map(pair => `${pair[0]}: ${pair[1]}`).join('; ') + '.') },
      order,
      { id: id(5), type: 'true_false', prompt: topic.check[0], options: [{ id: 'true', label: 'Verdadeiro' }, { id: 'false', label: 'Falso' }], correctAnswer: String(topic.check[1]), explanation: explanation(topic.check[2]) },
      ...practiceExercises(topic, index),
    ],
  };
}

export function topicUnit(id: string, title: string, topics: readonly Topic[]): Unit {
  return { id, title, lessons: topics.map((topic, index) => topicLesson(id, topic, index)) };
}
