import type { Question, QuestionOption, Unit } from '../types/learning.ts';

const options = (labels: readonly string[]): QuestionOption[] => labels.map((label, index) => ({ id: String(index + 1), label }));
const common = (id: string, prompt: string, labels: readonly string[], correctAnswer: string, explanation: string) => ({ id, prompt, options: options(labels), correctAnswer, explanation });
const revised = (question: Question): Question => ({ ...question, id: `${question.id}-v2` });

// Lesson identities and rewards stay stable. New exercise IDs version the content so
// queued attempts can still be validated against the previous server curriculum.
export function withVariedExercises(units: readonly Unit[]): readonly Unit[] {
  return units.map(unit => ({ ...unit, lessons: unit.lessons.map(lesson => {
    const q = lesson.questions.map(revised);
    const question = (index: number) => q[index]!;
    const replacements: Record<string, readonly Question[]> = {
      'o-que-e-a-biblia': [question(0), question(1),
        { ...common('biblia-3-v2','Separe os livros nas duas partes da Bíblia.',['Gênesis','Mateus','Salmos','João'],'','Gênesis e Salmos estão no Antigo Testamento; Mateus e João, no Novo.'), type:'classify', categories:options(['Antigo Testamento','Novo Testamento']), correctAnswer:{'1':'1','2':'2','3':'1','4':'2'} },
        { ...common('biblia-4-v2','Complete a divisão, da maior para a menor.',['Versículo','Testamento','Salmo'],'1','Livros são divididos em capítulos, e capítulos em versículos.'), type:'sequence', sequence:['Livro','Capítulo',null] },
        { ...common('biblia-5-v2','Qual trecho contém um erro?',['A Bíblia reúne livros.','Salmos contém poemas.','Romanos é um Evangelho.'],'3','Romanos é uma carta. Os Evangelhos são Mateus, Marcos, Lucas e João.'), type:'spot_the_error' },
      ],
      'antigo-e-novo-testamento': [question(0), question(1),
        { ...common('testamentos-3-v2','Qual livro não pertence ao grupo dos Evangelhos?',['Mateus','Marcos','Lucas','Romanos'],'4','Romanos é uma carta; os outros três livros são Evangelhos.'), type:'odd_one_out' }, question(3),
        { ...common('testamentos-5-v2','Selecione o trecho incorreto e substitua-o.',['Antigo','Terceiro','Último'],'1','Gênesis é o primeiro livro do Antigo Testamento.'), type:'fix_sentence', fragments:options(['Gênesis pertence ao','Novo','Testamento.']), correctAnswer:{fragment:'2',replacement:'1'} },
      ],
      'organizacao-da-biblia': [question(0),question(1),
        { ...common('organizacao-3-v2','Qual livro completa a ordem dos Evangelhos?',['Romanos','João','Atos'],'2','Na ordem usual do Novo Testamento, os Evangelhos são Mateus, Marcos, Lucas e João.'), type:'sequence', sequence:['Mateus','Marcos','Lucas',null] },
        { ...common('organizacao-4-v2','Encontre o erro nesta referência.',['Em João 3:16, o livro é João.','O capítulo é 16.','O versículo é 16.'],'2','O capítulo é 3. O número depois dos dois-pontos é o versículo, 16.'), type:'spot_the_error' },
        { ...common('organizacao-5-v2','Qual elemento não é uma divisão de uma referência bíblica?',['Livro','Capítulo','Versículo','Cidade'],'4','Uma referência identifica livro, capítulo e versículo; cidade não é uma dessas divisões.'), type:'odd_one_out' },
      ],
      revisao:[question(0),question(1),
        { ...common('revisao-3-v2','Qual acontecimento vem primeiro em Gênesis?',['Nascimento de Isaque','Chamado de Abraão'],'2','O chamado de Abraão é narrado antes do nascimento de Isaque.'), type:'before_after' },
        { ...common('revisao-4-v2','Selecione e corrija o nome nesta frase.',['Davi','Noé','Paulo'],'2','Gênesis apresenta Noé como o construtor da arca do dilúvio.'), type:'fix_sentence', fragments:options(['Moisés','construiu','a arca do dilúvio.']), correctAnswer:{fragment:'1',replacement:'2'} },question(4)],
      'personagens-importantes':[question(0),question(1),question(2),
        { ...common('personagens-4-v2','Quem está relacionado a esta descrição?',['Ester','Maria','Rute'],'2','Os Evangelhos apresentam Maria como a mãe de Jesus.'), type:'quote_character', quote:'Foi a mãe de Jesus, segundo os Evangelhos.', source:'Descrição baseada em Lucas 1–2; não é uma citação literal.' },
        { ...common('personagens-5-v2','Qual momento vem primeiro na história de Davi?',['Davi torna-se rei','Davi enfrenta Golias'],'2','Samuel narra o encontro com Golias antes do reinado de Davi.'), type:'before_after' }],
      'criacao-noe-e-abraao':[question(0),question(1),question(2),
        { ...common('origens-4-v2','O que acontece como consequência?',['A família entra na arca','Paulo escreve Romanos','Davi torna-se rei'],'1','Na narrativa de Gênesis, Noé prepara a arca para abrigar sua família e os animais.'), type:'cause_effect', event:'Noé prepara a arca antes do dilúvio.', relation:'effect' },
        { id:'origens-conteudo-v2',type:'content_card',prompt:'A família de Abraão',body:'Gênesis narra o chamado de Abraão e o nascimento de Isaque, filho de Abraão e Sara. Isaque é pai de Jacó. José é um dos filhos de Jacó.',options:[],correctAnswer:'seen',explanation:'' },
        { ...common('origens-5-v2','Qual resumo corresponde ao que você leu?',['José é pai de Abraão e Isaque.','Abraão é pai de Isaque, Isaque de Jacó, e José é filho de Jacó.','Moisés e Paulo são filhos de Abraão.'],'2','A narrativa apresenta as gerações Abraão, Isaque, Jacó e José.'), type:'story_summary', contentId:'origens-conteudo-v2' }],
      'moises-e-davi':[
        { ...common('lideres-1-v2','Qual nome não está no grupo de personagens do Antigo Testamento?',['Moisés','Davi','Noé','Paulo'],'4','Paulo aparece no Novo Testamento; os outros três personagens aparecem no Antigo.'),type:'odd_one_out' },question(1),question(2),
        { ...common('lideres-4-v2','Quem está relacionado a esta ação?',['Davi','Paulo','Abraão'],'1','Samuel narra Davi cuidando de ovelhas antes de enfrentar Golias e tornar-se rei.'),type:'quote_character',quote:'Cuidava de ovelhas antes de enfrentar Golias.',source:'Descrição baseada em 1 Samuel 17; não é uma citação literal.' },
        { ...common('lideres-5-v2','Qual acontecimento está relacionado como consequência?',['A resistência continua durante as pragas','Paulo viaja para Roma','Noé constrói a arca'],'1','Êxodo narra a resistência do faraó durante as pragas, antes de permitir a saída dos israelitas.'),type:'cause_effect',event:'O faraó recusa o pedido para libertar os israelitas.',relation:'effect' }],
      'jesus-e-paulo':[
        { id:'novo-conteudo-v2',type:'content_card',prompt:'Evangelhos, viagens e cartas',body:'Os Evangelhos narram a vida e os ensinamentos de Jesus. Atos apresenta os primeiros cristãos e suas viagens, incluindo as de Paulo. Romanos é uma carta a uma comunidade cristã.',options:[],correctAnswer:'seen',explanation:'' },
        { ...common('novo-1-v2','Qual resumo corresponde à leitura?',['Todos esses livros narram a criação.','Romanos é um Evangelho escrito por Moisés.','Os Evangelhos narram Jesus, Atos apresenta os primeiros cristãos e Romanos é uma carta.'],'3','Esses livros têm conteúdos e gêneros diferentes no Novo Testamento.'),type:'story_summary',contentId:'novo-conteudo-v2' },question(1),question(2),
        { ...common('novo-4-v2','Classifique os livros por Testamento.',['Êxodo','Lucas','Romanos','Gênesis'],'','Êxodo e Gênesis pertencem ao Antigo Testamento; Lucas e Romanos, ao Novo.'),type:'classify',categories:options(['Antigo Testamento','Novo Testamento']),correctAnswer:{'1':'1','2':'2','3':'2','4':'1'} },question(4)],
    };
    return { ...lesson, questions:replacements[lesson.id] ?? q };
  }) }));
}
