import type { FillBlankQuestion, Lesson, MatchingQuestion, MultiSelectQuestion, MultipleChoiceQuestion, OrderingQuestion, QuestionOption, TrueFalseQuestion, Unit, WhoAmIQuestion } from '../types/learning.ts';
import { withVariedExercises } from './variedExercises.ts';
import { topicLesson } from './curriculumBuilder.ts';
import { bibleFoundations, foundationalCharacters } from './curriculumFoundations.ts';
import { oldTestamentUnits } from './curriculumOldTestament.ts';
import { newTestamentUnits } from './curriculumNewTestament.ts';
import { extendFoundationalLessons } from './practiceExercises.ts';

function options(labels: readonly string[]): readonly QuestionOption[] {
  return labels.map((label, index) => ({ id: String(index + 1), label }));
}
function choice(id: string, prompt: string, labels: readonly string[], correctAnswer: string, explanation: string): MultipleChoiceQuestion {
  return { id, type: 'multiple_choice', prompt, options: options(labels), correctAnswer, explanation };
}
function boolean(id: string, prompt: string, correct: boolean, explanation: string): TrueFalseQuestion {
  return { id, type: 'true_false', prompt, options: [{ id: 'true', label: 'Verdadeiro' }, { id: 'false', label: 'Falso' }], correctAnswer: String(correct), explanation };
}
function blank(id: string, prompt: string, sentence: string, labels: readonly string[], correctAnswer: string, explanation: string): FillBlankQuestion {
  return { id, type: 'fill_blank', prompt, sentence, options: options(labels), correctAnswer, explanation };
}
function matching(id: string, prompt: string, left: readonly string[], right: readonly string[], corresponding: readonly string[], explanation: string): MatchingQuestion {
  return { id, type: 'matching', prompt, options: options(left), rightOptions: options(right), correctAnswer: Object.fromEntries(corresponding.map((rightId, index) => [String(index + 1), rightId])), explanation };
}
function ordering(id: string, prompt: string, labels: readonly string[], correctAnswer: readonly string[], explanation: string): OrderingQuestion {
  return { id, type: 'ordering', prompt, options: options(labels), correctAnswer, explanation };
}
function multi(id: string, prompt: string, labels: readonly string[], correctAnswer: readonly string[], explanation: string): MultiSelectQuestion {
  return { id, type: 'multi_select', prompt, options: options(labels), correctAnswer, explanation };
}
function who(id: string, clues: readonly string[], labels: readonly string[], correctAnswer: string, explanation: string): WhoAmIQuestion {
  return { id, type: 'who_am_i', prompt: 'Quem sou eu?', clues, options: options(labels), correctAnswer, explanation };
}

const unitId = 'conhecendo-a-biblia';
const legacyLessons: readonly Lesson[] = [
  {
    id: 'o-que-e-a-biblia', unitId, title: 'O que é a Bíblia?', description: 'Uma coleção de livros e histórias.',
    questions: [
      choice('biblia-1', 'O que é a Bíblia?', ['Um único poema', 'Uma coleção de livros', 'Um mapa de cidades'], '2', 'A Bíblia reúne diferentes livros, escritos em épocas e contextos distintos.'),
      blank('biblia-2', 'Complete a frase de Gênesis 1:1.', 'No princípio, Deus criou os {{blank}} e a terra.', ['mares', 'céus', 'desertos'], '2', 'Gênesis começa com a narrativa da criação dos céus e da terra.'),
      matching('biblia-3', 'Associe cada livro ao tipo de texto que ele contém.', ['Salmos', 'Gênesis', 'Romanos'], ['Carta', 'Poemas e cânticos', 'Narrativas das origens'], ['2', '3', '1'], 'Salmos reúne poemas e cânticos; Gênesis contém narrativas das origens; Romanos é uma carta.'),
      ordering('biblia-4', 'Organize as divisões da Bíblia, da maior para a menor.', ['Versículo', 'Livro', 'Capítulo'], ['2', '3', '1'], 'Um livro é dividido em capítulos, e os capítulos são divididos em versículos.'),
      who('biblia-5', ['Minha história aparece no Antigo Testamento.', 'Enfrentei o faraó do Egito.', 'Liderei a saída dos israelitas do Egito.'], ['Paulo', 'Davi', 'Moisés'], '3', 'Êxodo apresenta Moisés como líder na saída dos israelitas do Egito.'),
    ],
  },
  {
    id: 'antigo-e-novo-testamento', unitId, title: 'Antigo e Novo Testamento', description: 'Duas partes de uma grande história.',
    questions: [
      boolean('testamentos-1', 'Os Evangelhos fazem parte do Novo Testamento.', true, 'Mateus, Marcos, Lucas e João estão no Novo Testamento e narram a vida e os ensinamentos de Jesus.'),
      multi('testamentos-2', 'Quais destes livros são Evangelhos?', ['Mateus', 'Romanos', 'Marcos', 'Lucas', 'João'], ['1', '3', '4', '5'], 'Mateus, Marcos, Lucas e João são Evangelhos. Romanos é uma carta.'),
      blank('testamentos-3', 'Complete a divisão do livro.', 'Gênesis pertence ao {{blank}} Testamento.', ['Novo', 'Antigo', 'Terceiro'], '2', 'Gênesis é o primeiro livro do Antigo Testamento.'),
      matching('testamentos-4', 'Associe cada livro ou grupo ao seu conteúdo.', ['Gênesis', 'Evangelhos', 'Romanos'], ['Vida e ensinamentos de Jesus', 'Carta a uma comunidade cristã', 'Narrativas das origens'], ['3', '1', '2'], 'Gênesis apresenta narrativas das origens; os Evangelhos narram a vida de Jesus; Romanos é uma carta.'),
      who('testamentos-5', ['Minha história aparece no Novo Testamento.', 'Viajei para anunciar a mensagem de Jesus.', 'Várias cartas do Novo Testamento levam meu nome.'], ['Moisés', 'Paulo', 'Noé'], '2', 'Atos narra viagens de Paulo, e várias cartas do Novo Testamento levam seu nome.'),
    ],
  },
  {
    id: 'organizacao-da-biblia', unitId, title: 'Como a Bíblia é organizada', description: 'Livros, capítulos e versículos.',
    questions: [
      ordering('organizacao-1', 'Organize os três primeiros livros da Bíblia cristã.', ['Levítico', 'Gênesis', 'Êxodo'], ['2', '3', '1'], 'Na organização da Bíblia cristã, Gênesis é seguido por Êxodo e Levítico.'),
      matching('organizacao-2', 'Na referência João 3:16, associe cada parte.', ['Livro', 'Capítulo', 'Versículo'], ['16', 'João', '3'], ['2', '3', '1'], 'João é o livro, 3 é o capítulo e 16 é o versículo.'),
      choice('organizacao-3', 'Qual livro reúne muitos poemas, cânticos e orações?', ['Romanos', 'Salmos', 'Atos dos Apóstolos'], '2', 'Salmos reúne textos poéticos que expressam louvor, pedidos, gratidão e outros sentimentos.'),
      multi('organizacao-4', 'Quais afirmações sobre João 3:16 estão corretas?', ['O livro é João', 'O capítulo é 16', 'O capítulo é 3', 'O versículo é 16'], ['1', '3', '4'], 'O número antes dos dois-pontos é o capítulo; o número depois deles é o versículo.'),
      boolean('organizacao-5', 'Os livros bíblicos estão todos em uma ordem cronológica exata dos acontecimentos.', false, 'A organização também considera gêneros e tradições; não é uma linha do tempo exata.'),
    ],
  },
  {
    id: 'personagens-importantes', unitId, title: 'Personagens importantes', description: 'Conheça pessoas das narrativas bíblicas.',
    questions: [
      who('personagens-1', ['Fui rei de Israel.', 'Derrotei Golias, segundo a narrativa de Samuel.', 'Meu nome aparece nos títulos de vários salmos.'], ['Salomão', 'Davi', 'Noé'], '2', 'Samuel narra a vitória de Davi sobre Golias e seu reinado; vários salmos são atribuídos a Davi.'),
      matching('personagens-2', 'Associe cada pessoa à sua história.', ['Noé', 'Moisés', 'Maria'], ['Mãe de Jesus', 'Arca do dilúvio', 'Saída do Egito'], ['2', '3', '1'], 'Gênesis apresenta Noé e a arca; Êxodo apresenta Moisés; os Evangelhos apresentam Maria como mãe de Jesus.'),
      ordering('personagens-3', 'Organize estes acontecimentos na narrativa de Gênesis.', ['Nascimento de José', 'Nascimento de Isaque', 'Chamado de Abraão', 'Nascimento de Jacó'], ['3', '2', '4', '1'], 'Gênesis narra o chamado de Abraão antes dos nascimentos de Isaque, Jacó e José, nessa sequência.'),
      blank('personagens-4', 'Complete o nome da personagem.', 'Nos Evangelhos, {{blank}} é apresentada como a mãe de Jesus.', ['Rute', 'Ester', 'Maria'], '3', 'Maria é apresentada nos Evangelhos como a mãe de Jesus.'),
      choice('personagens-5', 'Quem está ligado a viagens e cartas no Novo Testamento?', ['Paulo', 'Abraão', 'Noé'], '1', 'Atos narra viagens de Paulo, e várias cartas do Novo Testamento levam seu nome.'),
    ],
  },
  {
    id: 'revisao', unitId, title: 'Revisão', description: 'Reúna o que você aprendeu.',
    questions: [
      multi('revisao-1', 'Selecione os Evangelhos nesta coleção de livros.', ['Romanos', 'Lucas', 'Mateus', 'João', 'Marcos'], ['2', '3', '4', '5'], 'Mateus, Marcos, Lucas e João são os quatro Evangelhos do Novo Testamento.'),
      blank('revisao-2', 'Complete a referência bíblica.', 'Em Gênesis 1:3, o versículo é o {{blank}}.', ['1', 'Gênesis', '3'], '3', 'O número depois dos dois-pontos indica o versículo: neste caso, 3.'),
      ordering('revisao-3', 'Organize as divisões, da maior para a menor.', ['Capítulo', 'Versículo', 'Livro'], ['3', '1', '2'], 'A referência bíblica identifica um livro, um capítulo desse livro e um versículo.'),
      boolean('revisao-4', 'Moisés é apresentado como o construtor da arca na narrativa do dilúvio.', false, 'O construtor da arca é Noé. Moisés aparece na narrativa da saída do Egito.'),
      who('revisao-5', ['Minha história aparece em Gênesis.', 'Preparei um abrigo para minha família e animais.', 'Construí uma arca antes do dilúvio.'], ['Moisés', 'Davi', 'Noé'], '3', 'Na narrativa de Gênesis, Noé constrói a arca para abrigar sua família e animais.'),
    ],
  },
];

const storiesId = 'personagens-e-historias';
const storyLessons: readonly Lesson[] = [
  { ...legacyLessons[3]!, unitId: storiesId },
  {
    id: 'criacao-noe-e-abraao', unitId: storiesId, title: 'Dos começos à promessa', description: 'Criação, Noé e a família de Abraão.',
    questions: [
      blank('origens-1', 'Complete a narrativa da criação.', 'Em Gênesis, Deus chama a {{blank}} de dia.', ['luz', 'água', 'terra'], '1', 'Gênesis 1:5 chama a luz de dia e as trevas de noite.'),
      who('origens-2', ['Minha história está em Gênesis.', 'Minha família e animais foram abrigados juntos.', 'Construí uma arca na narrativa do dilúvio.'], ['Abraão', 'Noé', 'Moisés'], '2', 'Gênesis 6–9 apresenta Noé, sua família e a arca.'),
      ordering('origens-3', 'Ordene estes acontecimentos na narrativa de Gênesis.', ['Chamado de Abraão', 'Criação', 'Nascimento de Isaque', 'Dilúvio'], ['2', '4', '1', '3'], 'A narrativa passa pela criação, pelo dilúvio, pelo chamado de Abraão e pelo nascimento de Isaque.'),
      matching('origens-4', 'Associe cada pessoa à sua relação familiar em Gênesis.', ['Abraão', 'Isaque', 'José'], ['Filho de Jacó', 'Pai de Isaque', 'Pai de Jacó'], ['2', '3', '1'], 'Abraão é pai de Isaque, Isaque é pai de Jacó e José é filho de Jacó.'),
      boolean('origens-5', 'Segundo Gênesis, Isaque é filho de Abraão e Sara.', true, 'Gênesis 21 narra o nascimento de Isaque, filho de Abraão e Sara.'),
    ],
  },
  {
    id: 'moises-e-davi', unitId: storiesId, title: 'Moisés e Davi', description: 'Libertação, coragem e liderança.',
    questions: [
      choice('lideres-1', 'Em qual livro é narrada a saída dos israelitas do Egito?', ['Salmos', 'Êxodo', 'Romanos'], '2', 'Êxodo narra a saída do Egito e apresenta Moisés como líder.'),
      matching('lideres-2', 'Associe as pessoas às narrativas em que aparecem.', ['Moisés', 'Davi', 'Golias'], ['Rei de Israel', 'Oponente enfrentado por Davi', 'Líder na saída do Egito'], ['3', '1', '2'], 'Moisés lidera a saída do Egito; Davi enfrenta Golias e depois se torna rei de Israel.'),
      multi('lideres-3', 'Quais acontecimentos pertencem à história de Moisés?', ['Saída do Egito', 'Construção da arca de Noé', 'Entrega dos mandamentos no Sinai', 'Viagens de Paulo'], ['1', '3'], 'Êxodo associa Moisés à saída do Egito e aos mandamentos no Sinai.'),
      who('lideres-4', ['Antes de ser rei, cuidei de ovelhas.', 'Enfrentei Golias.', 'Meu nome está associado a vários salmos.'], ['Davi', 'Paulo', 'Abraão'], '1', 'Samuel apresenta Davi como pastor, vencedor de Golias e futuro rei.'),
      ordering('lideres-5', 'Organize estes momentos da história de Davi.', ['Torna-se rei', 'Cuida de ovelhas', 'Enfrenta Golias'], ['2', '3', '1'], 'Na narrativa de Samuel, Davi cuida de ovelhas, enfrenta Golias e mais tarde se torna rei.'),
    ],
  },
  {
    id: 'jesus-e-paulo', unitId: storiesId, title: 'Jesus e os primeiros cristãos', description: 'Evangelhos, viagens e cartas.',
    questions: [
      multi('novo-1', 'Quais livros narram a vida e os ensinamentos de Jesus?', ['Mateus', 'Romanos', 'João', 'Gênesis'], ['1', '3'], 'Mateus e João são Evangelhos; Romanos é uma carta e Gênesis pertence ao Antigo Testamento.'),
      blank('novo-2', 'Complete o nome do lugar.', 'Nos Evangelhos, Jesus é apresentado como nascido em {{blank}}.', ['Roma', 'Belém', 'Atenas'], '2', 'Mateus 2 e Lucas 2 situam o nascimento de Jesus em Belém.'),
      boolean('novo-3', 'Paulo está ligado a viagens missionárias narradas em Atos.', true, 'Atos narra viagens de Paulo para anunciar a mensagem de Jesus.'),
      matching('novo-4', 'Associe os livros ao seu conteúdo principal.', ['Lucas', 'Atos', 'Romanos'], ['Carta a uma comunidade cristã', 'Vida e ensinamentos de Jesus', 'Primeiros cristãos e suas viagens'], ['2', '3', '1'], 'Lucas é um Evangelho, Atos narra os primeiros cristãos e Romanos é uma carta.'),
      who('novo-5', ['Minha história aparece em Atos.', 'Viajei entre diferentes comunidades.', 'Várias cartas do Novo Testamento levam meu nome.'], ['Noé', 'Davi', 'Paulo'], '3', 'Paulo aparece em Atos e seu nome está associado a várias cartas do Novo Testamento.'),
    ],
  },
];
export const legacyLearningUnits: readonly Unit[] = [
  { id: unitId, title: 'Conhecendo a Bíblia', lessons: [...legacyLessons.slice(0, 3), legacyLessons[4]!] },
  { id: storiesId, title: 'Personagens e Histórias Fundamentais', lessons: storyLessons },
];
export const previousLearningUnits = withVariedExercises(legacyLearningUnits);
export const previousLessonIds = previousLearningUnits.flatMap(unit => unit.lessons.map(lesson => lesson.id));
const expandedLearningUnits: readonly Unit[] = [
  ...previousLearningUnits.map((unit, index) => ({
    ...unit,
    lessons: [...unit.lessons, ...(index === 0 ? bibleFoundations : foundationalCharacters).map((topic, position) => topicLesson(unit.id, topic, position + unit.lessons.length))],
  })),
  ...oldTestamentUnits,
  ...newTestamentUnits,
];
export const fiveQuestionLearningUnits: readonly Unit[] = expandedLearningUnits.map(unit => ({ ...unit, lessons: unit.lessons.map(lesson => ({ ...lesson, questions: lesson.questions.filter(question => !question.id.endsWith('-practice-v3')) })) }));
export const learningUnits: readonly Unit[] = extendFoundationalLessons(expandedLearningUnits);
// Keep the existing storage/course identity while the engine traverses both units.
export function combineUnits(units: readonly Unit[]): Unit {
  if (!units.length) throw new Error('Jornada sem unidades.');
  return { id: units[0]!.id, title: units[0]!.title, lessons: units.flatMap(unit => unit.lessons) };
}
export const initialUnit: Unit = combineUnits(learningUnits);
export const legacyLessonIds = legacyLessons.map(lesson => lesson.id);
export function journeyUnits(course: Unit): readonly Unit[] {
  const ids = [...new Set(course.lessons.map(lesson => lesson.unitId))];
  return ids.map(id => ({ id, title: learningUnits.find(unit => unit.id === id)?.title ?? course.title, lessons: course.lessons.filter(lesson => lesson.unitId === id) }));
}
export function findLesson(id: string | undefined): Lesson | undefined {
  return initialUnit.lessons.find(lesson => lesson.id === id);
}
