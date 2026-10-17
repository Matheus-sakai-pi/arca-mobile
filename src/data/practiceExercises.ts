import type { Question, QuestionOption, Unit } from '../types/learning.ts';
import type { Topic } from './curriculumBuilder.ts';

type PracticeTopic = Pick<Topic, 'id' | 'reference' | 'pairs' | 'steps'>;
const options = (labels: readonly string[]): QuestionOption[] => labels.map((label, index) => ({ id: String(index + 1), label }));
const rotate = <T>(items: readonly T[], offset: number): T[] => [...items.slice(offset % items.length), ...items.slice(0, offset % items.length)];

// Revisit authored facts with reverse recall, associations and narrative sequence.
// IDs are additive: the original five questions are never replaced or renumbered.
export function practiceExercises(topic: PracticeTopic, position: number): readonly Question[] {
  const id = (slot: number) => `${topic.id}-${slot}-practice-v3`;
  const explanation = (text: string) => `${text} (${topic.reference})`;
  const labels = rotate(topic.pairs.map(pair => pair[0]), position + 1);
  const descriptions = rotate(topic.pairs.map(pair => pair[1]), position + 2);
  const associations = rotate([
    { label: `${topic.pairs[0][0]}: ${topic.pairs[0][1]}`, correct: true },
    { label: `${topic.pairs[1][0]}: ${topic.pairs[1][1]}`, correct: true },
    { label: `${topic.pairs[2][0]}: ${topic.pairs[0][1]}`, correct: false },
    { label: `${topic.pairs[0][0]}: ${topic.pairs[2][1]}`, correct: false },
  ], position % 4);
  const missing = position % 2 === 0 ? 0 : 2;
  const steps = rotate(topic.steps, position + 1);
  const validPair = position % 2 === 0;
  return [
    { id: id(6), type: 'multiple_choice', prompt: `Qual elemento corresponde a esta descrição: ${topic.pairs[0][1]}?`, options: options(labels), correctAnswer: String(labels.indexOf(topic.pairs[0][0]) + 1), explanation: explanation(`${topic.pairs[0][0]}: ${topic.pairs[0][1]}.`) },
    { id: id(7), type: 'fill_blank', prompt: 'Complete a associação.', sentence: `${topic.pairs[1][0]}: {{blank}}.`, options: options(descriptions), correctAnswer: String(descriptions.indexOf(topic.pairs[1][1]) + 1), explanation: explanation(`${topic.pairs[1][0]}: ${topic.pairs[1][1]}.`) },
    { id: id(8), type: 'multi_select', prompt: 'Quais associações estão corretas?', options: options(associations.map(pair => pair.label)), correctAnswer: associations.flatMap((pair, index) => pair.correct ? [String(index + 1)] : []), explanation: explanation(topic.pairs.map(pair => `${pair[0]}: ${pair[1]}`).join('; ') + '.') },
    { id: id(9), type: 'sequence', prompt: 'Complete a sequência estudada.', sequence: topic.steps.map((step, index) => index === missing ? null : step), options: options(steps), correctAnswer: String(steps.indexOf(topic.steps[missing]!) + 1), explanation: explanation(`A sequência é: ${topic.steps.join(' → ')}.`) },
    { id: id(10), type: 'true_false', prompt: `A associação "${topic.pairs[2][0]}: ${topic.pairs[validPair ? 2 : 1][1]}" está correta.`, options: [{ id: 'true', label: 'Verdadeiro' }, { id: 'false', label: 'Falso' }], correctAnswer: String(validPair), explanation: explanation(`A associação correta é ${topic.pairs[2][0]}: ${topic.pairs[2][1]}.`) },
  ];
}

const foundationalPractice: readonly PracticeTopic[] = [
  { id: 'o-que-e-a-biblia', reference: 'Gênesis 1; Salmos 23; Romanos 1',
    pairs: [['Gênesis', 'Narrativas dos começos'], ['Salmos', 'Poemas e cânticos'], ['Romanos', 'Carta a cristãos de Roma']], steps: ['Livro', 'Capítulo', 'Versículo'] },
  { id: 'antigo-e-novo-testamento', reference: 'Gênesis 1; Lucas 1; Romanos 1',
    pairs: [['Gênesis', 'Primeiro livro do Antigo Testamento'], ['Lucas', 'Um dos quatro Evangelhos'], ['Romanos', 'Uma carta do Novo Testamento']], steps: ['Mateus', 'Marcos', 'Lucas'] },
  { id: 'organizacao-da-biblia', reference: 'Salmos 23:1; João 3:16',
    pairs: [['João 3:16', 'Capítulo 3, versículo 16'], ['Salmos 23:1', 'Capítulo 23, versículo 1'], ['Gênesis 1:2', 'Capítulo 1, versículo 2']], steps: ['Localizar o livro', 'Localizar o capítulo', 'Localizar o versículo'] },
  { id: 'revisao', reference: 'Gênesis 6–9; Êxodo 3–14; Lucas 1–2',
    pairs: [['Noé', 'Construtor da arca do dilúvio'], ['Moisés', 'Líder na saída do Egito'], ['Maria', 'Mãe de Jesus']], steps: ['Chamado de Abraão', 'Nascimento de Isaque', 'Nascimento de Jacó'] },
  { id: 'personagens-importantes', reference: 'Gênesis 12; 21; 25; 37; 1 Samuel 17; Atos 9',
    pairs: [['Abraão', 'Pai de Isaque'], ['Davi', 'Enfrentou Golias'], ['Paulo', 'Viajou para anunciar Jesus']], steps: ['Nascimento de Isaque', 'Nascimento de Jacó', 'Nascimento de José'] },
  { id: 'criacao-noe-e-abraao', reference: 'Gênesis 1; 6–9; 12; 21',
    pairs: [['Criação', 'Narrativa dos começos'], ['Noé', 'Construiu a arca'], ['Sara', 'Mãe de Isaque']], steps: ['Criação', 'Dilúvio', 'Chamado de Abraão'] },
  { id: 'moises-e-davi', reference: 'Êxodo 3; 14; 19–20; 1 Samuel 16–17; 2 Samuel 5',
    pairs: [['Moisés', 'Liderou a saída do Egito'], ['Davi', 'Rei que antes cuidava de ovelhas'], ['Golias', 'Oponente enfrentado por Davi']], steps: ['Moisés encontra a sarça', 'Israel sai do Egito', 'Israel chega ao Sinai'] },
  { id: 'jesus-e-paulo', reference: 'Lucas 2; Atos 1; 9; Romanos 1',
    pairs: [['Lucas', 'Evangelho que narra o nascimento de Jesus'], ['Atos', 'Narrativa das primeiras comunidades'], ['Romanos', 'Carta dirigida a cristãos de Roma']], steps: ['Nascimento de Jesus', 'Ministério de Jesus', 'Viagens de Paulo'] },
];

export function extendFoundationalLessons(units: readonly Unit[]): readonly Unit[] {
  return units.map(unit => ({ ...unit, lessons: unit.lessons.map((lesson, position) => {
    const topic = foundationalPractice.find(item => item.id === lesson.id);
    return topic ? { ...lesson, questions: [...lesson.questions, ...practiceExercises(topic, position)] } : lesson;
  }) }));
}
