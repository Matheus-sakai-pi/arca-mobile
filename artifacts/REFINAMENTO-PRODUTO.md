# Refinamento de produto - 7 de outubro de 2026

## Entrega

Os sete formatos originais foram preservados. Nove novos formatos usam componentes e validadores separados: odd_one_out, fix_sentence, before_after, sequence, classify, cause_effect, quote_character, spot_the_error e story_summary. QuestionRenderer registra cada componente por tipo; a tela da lição continua responsável por progresso, verificação, feedback, som, haptic, resultado e conclusão. Novos formatos não contêm regras por lição.

Cada uma das oito lições tem cinco exercícios pontuáveis de cinco tipos distintos. Duas leituras adicionais precedem seus próprios exercícios story_summary. Conteúdo factual, com descrições identificadas como paráfrases, não citações literais inventadas. Cartões de leitura não acrescentam acertos nem XP. IDs de unidades/lições e fórmula de recompensa permanecem estáveis.

## Arquivos criados

- src/data/variedExercises.ts: currículo revisado e versionado.
- src/components/learning/questions/OddOneOutQuestion.tsx: quatro elementos em grade.
- src/components/learning/questions/FixSentenceQuestion.tsx: trecho interativo e substituição.
- src/components/learning/questions/BeforeAfterQuestion.tsx: dois acontecimentos lado a lado.
- src/components/learning/questions/SequenceQuestion.tsx: sequência conectada com lacuna.
- src/components/learning/questions/ClassifyQuestion.tsx: itens distribuídos por toque em duas categorias.
- src/components/learning/questions/CauseEffectQuestion.tsx: acontecimento e relação causal.
- src/components/learning/questions/QuoteCharacterQuestion.tsx: descrição com fonte e personagens.
- src/components/learning/questions/SpotTheErrorQuestion.tsx: parágrafo interativo.
- src/components/learning/questions/StorySummaryQuestion.tsx: três resumos após leitura.
- src/components/learning/GuestProgressImportDialog.tsx e src/lib/guestImportPolicy.ts: convite explícito de importação.
- src/components/profile/ProfileSettings.tsx e src/providers/PreferencesProvider.tsx: configurações no Perfil e preferência de som persistente.
- scripts/generate-exercise-upgrade.ts, supabase/templates/varied-exercises.sql e supabase/migrations/202610070001_varied_exercises.sql: atualização aditiva do backend existente.
- tests/productRefinement.test.ts: regressões desta rodada.
- tests/ui/ExercisesPreview.tsx: fixture de inspeção isolada, fora das rotas de produção.
- assets/mascot/thinking.png, reading.png e celebrating.png: imagens transparentes separadas.
- artifacts/product-*.png: evidências visuais em telas pequenas.

## Arquivos alterados

- src/types/learning.ts, src/lib/questionEngine.ts e src/lib/backendDecoders.ts: contratos, validação de respostas e conteúdo, associação entre leitura/resumo.
- src/components/learning/QuestionRenderer.tsx e LessonPlayer.tsx: registro de componentes, instruções, mascot contextual, feedback compacto e contador de exercícios separado das leituras.
- src/data/lessons.ts: currículo original preservado como legacyLearningUnits; currículo atual usa withVariedExercises.
- src/services/learning.ts: consulta somente perguntas ativas, order_index < 1000.
- src/providers/LearningProvider.tsx, src/components/learning/SyncNotice.tsx e src/components/auth/AuthForm.tsx: importação somente após intenção explícita, sem banner espontâneo.
- src/app/_layout.tsx e src/hooks/useLessonSounds.ts: integração da preferência, mantendo players/reprodução existentes.
- src/app/(tabs)/home.tsx: card branco compacto, hierarquia, livro aberto e progresso visível.
- src/app/(tabs)/learn.tsx, src/lib/journeyLayout.ts, src/components/learning/JourneyNode.tsx e ProgressBar.tsx: headers, distância entre nós, profundidade e animação de progresso respeitando redução de movimento.
- src/app/(tabs)/profile.tsx: configurações no header, lições/unidades concluídas, maior streak e área futura de conquistas.
- src/components/mascot/Mascot.tsx e assets/mascot/README.md: registro contextual das poses, sem remover idle.png.
- scripts/generate-seed.ts e supabase/seed.sql: geração do conteúdo atual sem sobrescrever migrations antigas.
- tests/learningFixtures.ts, questions.test.ts, learning.test.ts, refinements.test.ts, database.test.ts e journey.test.ts: novos formatos, pontuação, currículo e compatibilidade de dados.
- supabase/README.md: instruções atualizadas.

A rota temporária qa-product utilizada na inspeção foi removida. Nenhuma migration antiga, avatar_key, asset de animal, recompensa ou dado de usuário foi apagado.

## Progresso visitante

Não existe aviso automático de progresso visitante em SyncNotice. A restauração de sessão não abre modal. Salve seu progresso ou uma submissão explícita de cadastro/login prepara o convite Encontramos progresso neste aparelho, com XP local, lições concluídas, Importar progresso e Agora não. A intenção sobrevive à troca visitante/conta durante o fluxo.

Importar sem conta leva ao cadastro. Importar com conta exige conexão e confirmação do servidor. Erros ficam no modal, permitem nova tentativa e conservam o snapshot. Agora não fecha o convite e não apaga nada. O snapshot visitante também permanece depois da importação. Alertas reais de conexão, pendência e rejeição continuam disponíveis.

## Supabase: ação pendente

Não foi criado backend novo nem aplicada migration remota. Para contas receberem os novos formatos, aplique a sexta migration no projeto existente, depois das cinco anteriores:

`supabase/migrations/202610070001_varied_exercises.sql`

Se as cinco anteriores já estiverem aplicadas, execute somente essa. Em um projeto novo, aplique as seis em ordem. Não use db reset, não reaplique migrations antigas e não execute seed antigo.

A atualização arquiva perguntas anteriores em order_index >= 1000 e publica a versão atual abaixo de 1000. IDs de lições e dados dos usuários permanecem. Tentativas antigas que já estavam offline continuam sendo avaliadas contra as perguntas antigas; novas contra as atuais. Versões misturadas são rejeitadas. Recibos, XP único por lição, desbloqueio, RLS e streak continuam válidos. A importação calcula os limites com os cinco exercícios ativos, não com os arquivados.

Não reescreva essa migration depois de publicada/aplicada. Futuras versões exigem uma nova migration. O gerador desta rodada não modifica as cinco migrations históricas.

## Mascote e geração

Modo utilizado: ferramenta nativa image_gen, três gerações independentes, transparent_background true. Sem API/CLI externo, URLs externas, recorte da folha de referência ou sobrescrita do asset original. Arquivos finais no projeto:

- assets/mascot/thinking.png
- assets/mascot/reading.png
- assets/mascot/celebrating.png

Referência principal: idle.png existente, com a folha fornecida como direção de identidade, cores e expressões. Prompts normalizados para reproduzir o conjunto:

1. Pensando: mascote sábio do Arca, barba e cabelos brancos, túnica clara e faixa vermelha, mesmas proporções e acabamento 3D suave da referência existente. Expressão curiosa, mão no queixo, livro fechado. Personagem central completo no enquadramento, com margem e fundo realmente transparente. Sem textos, folha de poses ou outros personagens.
2. Leitura: mesmo mascote, paleta, proporções e acabamento. Livro aberto nas mãos, olhos atentos à leitura, expressão acolhedora. Enquadramento com margem, fundo realmente transparente, sem letras, cenário ou outros personagens.
3. Celebração: mesmo mascote, identidade, paleta e acabamento. Sorriso alegre, olhos fechados de felicidade, braços levantados celebrando. Fundo realmente transparente, enquadramento com margem, sem texto, cenário, folha de poses ou outros personagens.

Pensamento e leitura têm assets próprios. Happy, celebrating, streak e lesson_complete compartilham a pose de celebração; encouraging e wrong_answer usam a pose acolhedora original. O compartilhamento é intencional, não um placeholder. Não há animação quadro a quadro do personagem.

## Validação concluída

- npm run typecheck: passou.
- npm run lint: passou, zero warnings.
- npm test: 123 testes passaram, zero falhas.
- Exportação Android: passou, 3749 módulos, assets novos incluídos, saída dist/product-android.
- Banco PostgreSQL local via PGlite: todos os 16 formatos, conteúdo/leitura, respostas inválidas, RLS, importação, XP, idempotência, streak e versões offline antigas.
- Interface em 320 x 568 e 390 x 844: nove novos componentes com feedback correto/incorreto, sem overflow horizontal; classificação e correção de frase também operadas manualmente por seus controles reais.
- Fluxo real local na prévia: cinco exercícios, 4/5 corretos, 80%, +18 XP, conclusão, desbloqueio e retorno à trilha. Após recarregar, 18 XP e uma lição concluída permaneceram.
- Modal de importação cabe em 320 x 568, ambos os botões visíveis; Agora não preserva dados e o convite não reaparece espontaneamente.
- Preferência de som desligada persistiu após recarregar; foi restaurada para ligada ao finalizar.

A execução interativa usou somente o visitante da prévia local na porta 8084; não criou conta nem alterou progresso remoto. Os 18 XP desse teste permanecem apenas nessa prévia. Não houve aparelho Android acessível: exportar para Android não substitui teste físico de áudio/haptic/Expo Go. Testes automatizados de reprodução e formatos passaram; conferir no telefone continua sendo necessário.

## Placeholders e limitações mantidas

- Conquistas / Em breve: espaço reservado, sem conquistas inventadas.
- Streak de visitante continua zero, pois o armazenamento local legado não contém histórico diário; não foi inventada uma sequência.
- Respostas de uma tentativa em andamento permanecem em memória, como antes. Fechar durante a lição reinicia essa tentativa, sem apagar conclusões.
- Login, ranking e progresso de conta não foram substituídos por mocks. Os testes locais simulam auth.uid e ambiente do banco, não um login real no Supabase.

## Teste manual

1. Abra a versão atualizada pelo Expo Go na mesma rede do servidor. Na pasta do app, execute npx expo start --go --clear --port 8084 quando precisar reiniciar. A prévia web está em http://localhost:8084/home.
2. Como visitante, use Continuar, responda certo e errado, confira feedback/explicação/som/haptic, termine e compare XP, resultado e desbloqueio. Revise uma concluída: não deve conceder XP novamente.
3. Complete as duas unidades para encontrar todos os formatos. Na classificação selecione item e categoria; toque num item já colocado para corrigir. Na frase selecione trecho e substituição. No parágrafo toque no trecho errado. Leia o content_card antes do resumo.
4. Feche/reabra sem limpar armazenamento. Progresso deve permanecer, sem convite automático. Perfil > Salve seu progresso deve mostrar os totais locais. Agora não fecha sem apagar; Importar progresso deve levar ao cadastro ou importar após confirmação se já autenticado.
5. Aplique a migration pendente antes de testar o novo currículo com conta. Faça login, confira importação explícita e sincronização, e compare ranking/avatar/XP. Nunca use chave administrativa no app.
6. Perfil > Configurações: desligue som, responda e confirme silêncio. Reabra e confira preferência. Ligue novamente e teste errado, errado, correto, errado, correto, errado no Android.
7. Confira Home, moedas da trilha, headers de unidade, Perfil e modal em tela pequena. Nenhum animal decorativo foi reintroduzido; todos continuam no sistema de avatares.
