# Ranking, avatares e audio

## Implementacao

- `src/app/(tabs)/ranking.tsx`: ranking real, estados de carregamento/erro/vazio, atualizacao manual e pull-to-refresh.
- `src/hooks/useLeaderboard.ts`: uma RPC por entrada/atualizacao, cancelamento de requests antigos e isolamento entre contas. Atualiza ao voltar ao primeiro plano e quando nome, avatar ou XP confirmado muda. Nao busca todos os perfis, nao faz polling de ranking.
- `src/components/leaderboard/LeaderboardPodium.tsx`: Top 3 em ordem 2/1/3, alturas diferentes, medalhas Lucide, numerais e destaque da propria conta. Colunas flexiveis; nomes limitados a duas linhas e XP se ajusta ao espaco.
- `src/components/leaderboard/LeaderboardRow.tsx`: posicoes 4-10 e a propria posicao fora do Top 10, sem duplicacao.
- `src/types/leaderboard.ts`, `src/lib/leaderboard.ts`: contrato publico, validacao e projecao explicita dos campos recebidos.
- `src/components/profile/Avatar.tsx`, `AvatarPicker.tsx`: asset local circular, modal com cinco opcoes, selecao acessivel, salvar e tratamento de falha.
- `src/constants/avatarKeys.ts`, `avatars.ts`: registro central de chaves e `getAvatarSource`.
- `src/app/(tabs)/profile.tsx`: avatar real e botao Escolher avatar para contas autenticadas. Visitantes continuam com entrada/cadastro; nao fingimos salvar no servidor sem conta.
- `src/services/learning.ts`, `src/types/backend.ts`, `src/lib/accountLearningStore.ts`, `src/providers/LearningProvider.tsx`: mutacao exclusiva de avatar. Apenas `avatar_key` e `updated_at` retornam nessa operacao; o cache existente preserva progresso, XP e fila offline. Nao baixa novamente unidade, perguntas ou snapshot completo ao trocar avatar.
- `src/components/common/Screen.tsx`: suporte opcional a RefreshControl; `IconButton.tsx`: estado desativado acessivel. Restante das telas preservado.
- `src/hooks/useLessonSounds.ts`, `src/lib/feedbackPlayback.ts`: preparacao direta dos assets locais, eventos nativos de erro, recuperacao limitada e reuso dos dois players.
- `tests/leaderboard.test.ts`, `tests/accountLearning.test.ts`, `tests/refinements.test.ts`: testes adicionais. `tests/ui/RankingPreview.tsx` e uma fixture visual, sem import na aplicacao publicada.
- `supabase/migrations/202610060003_leaderboard.sql`: RPC e indice de ordenacao; avatar padrao para novas contas. Nenhum perfil/progresso existente e sobrescrito.
- `assets/avatars/avatar-01.png` ate `avatar-05.png`, `assets/avatars/README.md`: cinco imagens geradas reais e prompts de producao.
- `README.md`, `supabase/README.md`: configuracao, ordem das migrations e instrucoes atualizadas.

## RPC e privacidade

`learning_leaderboard()` devolve `{ top: [...], current: objeto | null }`.
Ordenacao: `xp_total DESC, id ASC`. Empates tem posicoes distintas e estaveis pelo UUID, sem depender de timestamps alterados ao editar avatar/nome.
Top 10 usa LIMIT 10 e indice `(xp_total DESC, id ASC)`. A posicao propria e 1 + COUNT dos perfis que a precedem. Essa contagem acontece no banco; no aparelho chegam no maximo dez participantes e a propria posicao.

Projecao publica EXATA: `id`, `display_name`, `avatar_key`, `xp_total`, `position`. Nada de email, username, senha, metadados de auth.users ou timestamps privados.
RPC SECURITY DEFINER com search_path vazio, tabelas qualificadas e grants explicitos para anon/authenticated. Visitantes podem ver o Top 10 publico, mas `current` e null. A propria identidade usa auth.uid(), sem aceitar IDs arbitrarios como argumento. RLS da tabela profiles continua permitindo leitura/edicao apenas da propria conta; XP segue protegido pelo backend existente.
O ranking usa XP confirmado no servidor, nao XP pendente de sincronizacao no celular.

## Etapa manual no Supabase

A consulta ao projeto configurado retornou PGRST202: a nova RPC ainda NAO existe no servidor. Nenhuma alteracao remota foi realizada.

1. No projeto Supabase correto, abra SQL Editor.
2. Se as tres migrations anteriores ja foram aplicadas, execute SOMENTE `supabase/migrations/202610060003_leaderboard.sql`. Nao reaplique as anteriores nem o seed para esta melhoria.
3. Se o backend anterior ainda nao foi provisionado, siga primeiro o README do app: migrations em ordem cronologica e seed; depois aplique a nova migration.
4. Confirme no SQL Editor: `select public.learning_leaderboard();`. No SQL Editor a sessao geralmente nao tem auth.uid(), entao `current` sera null; a posicao propria deve ser testada pelo app autenticado.
5. Volte ao app e toque no icone Atualizar ranking, ou puxe a pagina para baixo no Android.

Alternativa para um projeto ja vinculado ao CLI Supabase: `supabase db push`. Isso exige suas credenciais administrativas no seu ambiente. Nao configure service_role no app ou em EXPO_PUBLIC_*.

## Avatares

Cinco PNGs locais reais, gerados com a ferramenta de imagens integrada. Nenhuma URL externa, Storage Supabase ou placeholder.
O banco guarda somente a chave textual, por exemplo `avatar-03`. `getAvatarSource` resolve essa chave para um require estatico. `learner`, chaves desconhecidas e valores ausentes usam `avatar-01`, sem migrar/destruir os perfis antigos.
Salvar faz UPDATE exclusivamente de avatar_key no proprio perfil. O provider compartilhado e atualizado depois da confirmacao e o cache da conta e persistido em AsyncStorage; reabrir offline mantem a selecao. Ao voltar ao Ranking, a identidade compartilhada ja mostra o avatar novo e a RPC atualiza os dados publicos.
Home nao exibia avatar antes e foi preservada sem redesenho; qualquer novo consumidor deve usar Avatar/getAvatarSource.

Para adicionar um avatar: incluir PNG quadrado em assets/avatars, adicionar chave/rotulo em avatarKeys.ts e require estatico em avatars.ts. Nao usar require de caminho dinamico. Nao precisa armazenar PNG no banco nem alterar RPC. Prompts e origem dos cinco assets estao no README desse diretorio.

## Audio: diagnostico comprovado e limite da conclusao

Os assets correct.wav e wrong.wav existem, sao distintos, PCM mono 16 bits/44.1 kHz, respectivamente 480 e 360 ms, com sinal nao vazio e sem clipping. Os requires apontam aos arquivos certos. Todos os sete exercicios usam a mesma verificacao em LessonPlayer: som, haptic e feedback visual dependem do mesmo resultado. Nao havia uma chamada de erro faltando por formato. Os hooks ficam fora do Screen com key da pergunta; avancar nao desmonta os players.

Defeito reproduzido: no expo-audio 57.0.5 Android, AudioPlayer.currentStatus() devolve error=null; o erro do decoder chega em playbackStatusUpdate. O controlador antigo ignorava o payload desse evento e relia somente currentStatus. Assim perdia a falha real, esperava timeout e mantinha a fonte falha indefinidamente. O teste novo reproduz essa diferenca entre evento e getter e exige recuperacao do player errado.

Correcao: consumir o evento, guardar a falha de preparacao mesmo quando anterior ao clique e recarregar somente a fonte falha UMA vez; aguardar preparo, pausar/seekTo(0)/play. O reload tambem cobre falha sincrona de seek/play. Fontes saudaveis nunca sao recarregadas por resposta. Players separados, referencias estaveis entre perguntas, cancelamento por foco/AppState e som ligado/desligado preservados. Assets locais sao entregues diretamente a useAudioPlayer, sem a etapa adicional downloadFirst/null/replace. Pre-carregam ao abrir a licao.

Isso corrige um defeito concreto de recuperacao/diagnostico, mas NAO prova qual falha de dispositivo provocou o silencio relatado: nao ha Android fisico/adb acessivel nesta sessao. Nao atribuir o silencio a um arquivo corrupto, volume ou download sem logs. Confirmacao auditiva no Expo Go continua pendente.

Para investigar no aparelho se persistir: habilite diagnostics em src/constants/sounds.ts; confira nos logs [arca.audio.wrong] loaded, playing, duration e erro. Falhas finais sao registradas em desenvolvimento mesmo com diagnostics=false. Use volume de MIDIA, nao apenas volume de toque, e desative diagnosticos depois do teste. Nenhuma permissao de microfone e necessaria.

## Teste manual

1. Aplicar a migration e abrir com Expo Go Android, na mesma rede: `npx expo start --go --port 8084`. Escanear QR pelo Expo Go. A previa web e http://localhost:8084/ranking.
2. Em ambiente de teste separado, cadastrar contas com emails que voce controla e confirmar autenticacao. Ganhar XP concluindo licoes, sem alterar XP pelo cliente. Para 37 participantes, criar contas de teste no Supabase de desenvolvimento; nao criar participantes ficticios no backend de producao.
3. Com menos de 10 contas, conferir apenas participantes existentes; com mais de 10, conferir Top 10 e posicao propria abaixo, sem duplicacao para quem ja esta no Top 10. Empates devem manter ordem apos refresh e edicao de nome/avatar.
4. Perfil > Escolher avatar > selecionar > Salvar. Conferir destaque, Ranking, fechar/reabrir e persistencia. Sem rede, tentar salvar deve mostrar falha e preservar a selecao anterior.
5. Testar em 320 px e Android pequeno: podium 2/1/3, nomes longos, XP grande, grid rolavel, Salvar e fechar acessiveis; nao deve haver overflow horizontal.
6. Em revisoes ja liberadas, fazer errado, errado, correto, errado, correto, errado. Conferir TODOS os sons e haptics. Repetir em escolha, lacuna, pares, ordenacao, multi_select, V/F e pistas; leituras nao emitem feedback de correcao. Nao acumular XP por revisar.
7. Sair da licao/mudar app durante carregamento nao pode emitir som tardio. Reentrar na licao deve reativar audio.

## Verificacao automatizada

Typecheck, lint e testes devem ser executados no diretorio arca-mobile. PostgreSQL real em memoria (PGlite) testa a SQL/RLS com roles anon/authenticated, sem mock de SQL e sem tocar o Supabase remoto. As fixtures visuais e os players de teste NAO simulam confirmacao auditiva no Android.
Export Android final: `npx expo export --platform android --output-dir dist/ranking-android-final`. Em ambiente Windows restrito, TEMP/TMP foram direcionados para .cache/export-tmp para o compilador Hermes.
Expo Audio continua na versao recomendada do SDK 57 e incluida no Expo Go: https://docs.expo.dev/versions/v57.0.0/sdk/audio/ . Nenhuma nova dependencia nativa foi adicionada.

## Resultados desta entrega

- TypeScript: passou.
- Lint: passou, sem warnings.
- Testes: 94/94 passaram, incluindo SQL/RLS, empate, Top 10/posicao 37, persistencia do avatar e recuperacao/repeticao dos players.
- Exportacao Android Hermes: passou, 3722 modulos e 40 assets. As cinco imagens e os dois sons estao incluidos; a fixture visual nao esta no bundle final.
- Verificacao local de dependencias Expo: atualizadas; executada offline, nao substitui uma auditoria online.
- Previa dos componentes em 320x568 e 390x844: sem overflow horizontal, imagens carregadas, selecao e salvamento do avatar verificados com fixture de teste. Screenshots em artifacts/ranking-320.png, ranking-390.png, avatars-320.png e avatars-390.png. Esses participantes sao SOMENTE da fixture, nao do ranking publicado.
- Aplicacao real: visitante navega de onboarding/login para Home e Ranking. A RPC ausente produz erro explicito, sem participantes inventados. Leitura remota confirmou PGRST202; nenhuma migration ou alteracao de perfil foi executada remotamente.
- Servidor Expo ativo na porta 8084. Manifesto Android via rede local retornou SDK 57.0.0 e bundle acessivel em 192.168.101.191:8084. No Expo Go, abrir exp://192.168.101.191:8084, com celular e computador na mesma rede; esse IP pode mudar.
- Confirmacao auditiva/haptic no Android fisico: PENDENTE. O usuario informou que ainda nao testou. Os testes automatizados nao comprovam audibilidade no aparelho.
- Ranking autenticado e salvamento real do avatar no Supabase: testar apos aplicar a nova migration e entrar com sua conta. Persistencia e permissoes foram verificadas localmente, nao com credenciais privadas no servidor.

Para autenticacao pela previa web na nova porta, incluir http://localhost:8084/** entre as URLs de redirecionamento permitidas no Supabase caso se use um link de confirmacao. Manter os redirecionamentos nativos ja configurados para o Expo Go.
