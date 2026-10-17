# Exercícios variados

Etapa de 6 de outubro de 2026. Sem novas dependências, mudanças de rotas, migração de armazenamento ou conexão remota.

## Implementação

- `src/types/learning.ts`: união discriminada dos sete tipos, respostas simples/listas/pares e contratos de dados específicos.
- `src/lib/questionEngine.ts`: registro de validadores, completude, avaliação e apresentação da solução por formato; validação do conteúdo e cópia das respostas para evitar mutação.
- `src/lib/lessonEngine.ts`: tentativa reutilizável recebe respostas estruturadas, bloqueia verificação incompleta e congela a resposta verificada. A fórmula de XP permanece igual.
- `src/components/learning/QuestionRenderer.tsx`: registro tipado de componentes e transição entre exercícios.
- `src/components/learning/questions/`: MultipleChoiceQuestion, FillBlankQuestion, MatchingQuestion, OrderingQuestion, TrueFalseQuestion, MultiSelectQuestion e WhoAmIQuestion, com elementos visuais compartilhados em QuestionParts.
- `src/components/learning/LessonPlayer.tsx`: integra os renderers, soluções, explicações e completude com os sons/haptics existentes; reinicia a rolagem ao trocar de exercício. Players de áudio continuam no jogador, fora dos componentes que são desmontados entre perguntas.
- `src/components/learning/QuestionOptions.tsx`: mantém o componente anterior para respostas simples.
- `src/data/lessons.ts`: 25 exercícios locais; cada lição tem cinco formatos distintos. IDs de unidade, lições e perguntas foram preservados.
- `src/providers/LearningProvider.tsx` e `src/lib/learningProgress.ts`: recebem o novo tipo de resposta, sem alteração do schema/chave de armazenamento.
- `tests/learningFixtures.ts`, `tests/learning.test.ts` e `tests/questions.test.ts`: fixtures estruturadas e testes de todos os formatos, tentativas, XP e progresso.

## Progresso e feedback preservados

AsyncStorage continua usando `arca.learning.v1`, versão 1, para XP, unidade atual, IDs concluídos e último resultado. Respostas de tentativas interrompidas não são armazenadas. Nenhum dado existente foi apagado ou convertido. Revisões continuam recebendo zero XP.

Cada exercício recebe uma avaliação única: associação exige todos os pares corretos; ordenação exige a sequência exata; seleção múltipla exige todas e somente as respostas corretas. As regras continuam +2 XP por exercício correto, +10 por conclusão e +5 por 100%, somente na primeira conclusão.

Os dois sons locais e o hook de `expo-audio` não foram alterados. Uma verificação dispara som e haptic, não cada par, movimento ou pista. Os players permanecem pré-carregados durante a lição. A correção anterior do replay via `currentStatus.isLoaded` foi preservada.

## Verificação automática

- TypeScript: aprovado.
- Lint com zero warnings: aprovado.
- Testes: 58 aprovados. Cobrem os sete avaliadores, dados, seleção parcial, pares inválidos/duplicados, sequências incompletas/incorretas, conjunto exato de seleção múltipla, estado congelado, limpeza entre exercícios e compatibilidade com progresso antigo.
- Export Android/Hermes: gerado em `dist/exercises-android`, incluindo mascote e os dois WAV locais.
- Não há módulos nativos novos nem necessidade de development build para esta etapa.

## Teste da interface

Prévia executada com Expo em `http://localhost:8083`. Inspeção em viewport de 320 x 640: os sete componentes foram abertos e usados; textos e colunas permanecem no fluxo rolável. Verificar inicialmente desativado, feedback positivo/negativo, refazer associação, mover/remover eventos, revelar pistas e marcar/desmarcar seleção múltipla foram conferidos.

Revisão da primeira lição: 4/5, 80%, +0 XP e total anterior de 118 XP mantido. Segunda revisão: 3/5, 60% e +0 XP, incluindo pares incorretos e corretos no mesmo exercício. Após recarregar e entrar novamente como visitante, 118 XP e cinco lições concluídas continuaram presentes. Console do navegador sem erros/warnings no teste dos formatos. Captura das pistas progressivas em `exercicio-pistas.jpg`.

Isso não equivale a teste em Android físico. Não havia aparelho conectado nem ADB disponível. Audição dos efeitos, haptic, toque/rolagem nativa e botão voltar físico ainda precisam ser confirmados no Expo Go. A geração Android valida imports/assets e compilação, não essas interações no aparelho.

## Roteiro no Expo Go

1. Na pasta `arca-mobile`, execute `npx expo start --go --clear`; celular e computador precisam conseguir se alcançar pela rede. Abra o QR code no Expo Go compatível com SDK 57. Não limpe dados do app.
2. Entre como visitante, se necessário. Confira seu XP e lições concluídas anteriores. Uma revisão não deve conceder mais XP.
3. Abra O que é a Bíblia?: responda uma alternativa; preencha a lacuna; selecione um livro da esquerda e o tipo de texto da direita até formar todos os pares. Refazer um par deve continuar possível antes de verificar.
4. Na ordenação, toque em todos os itens, use as setas para trocar posições e remova um deles. Verificar deve ficar desativado até completar novamente. Monte Livro, Capítulo, Versículo.
5. Em Quem sou eu?, revele pistas e escolha Moisés. Cada pista não deve disparar recompensa; só Verificar dispara feedback.
6. Em Antigo e Novo Testamento, teste verdadeiro/falso e marque os quatro Evangelhos. Desmarque Romanos se o tiver marcado; não há acerto parcial se faltar uma resposta correta ou sobrar uma errada.
7. Em qualquer exercício, teste erro: destaque vermelho, solução, explicação e som suave. Teste acerto: verde, explicação, som positivo e haptic. Ouça especialmente as perguntas 3, 4 e 5 para conferir o replay dos sons existentes.
8. Termine uma lição ainda não concluída: confira XP conforme acertos, resultado, check na trilha e liberação seguinte. Se todas já estiverem concluídas, confira revisão com +0 XP, sem resetar dados para testar.
9. Feche e reabra o app e confira os mesmos XP/conclusões. Teste também Sair da lição e botão voltar: abandonar não deve conceder XP nem apagar progresso anterior.

## Limites

Conteúdo e progresso são locais, sem sincronização. O mascote ainda reutiliza a pose PNG existente. Ranking, outras unidades e configurações de som não foram adicionados. Nenhuma autenticação, serviço remoto ou funcionalidade fora desta etapa foi modificada.
