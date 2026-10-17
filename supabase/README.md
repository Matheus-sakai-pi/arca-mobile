# Backend do Arca

O app agora tem integração real com Supabase Auth/PostgreSQL. Sem configuração, ele continua no modo visitante local. Nenhum projeto remoto foi criado ou alterado nesta entrega.

## Privacidade e exclusão

A Edge Function `functions/delete-account` valida JWT e senha e exclui definitivamente o usuário pelo Admin API. As cascatas existentes removem os dados privados; nenhuma chave administrativa deve entrar no app. Publique a função no painel ou pela CLI antes de testar com uma conta descartável. O código de arquivo único para o editor fica em `artifacts/delete-account.function.ts`. As páginas externas e as instruções completas estão em [Privacidade e exclusão](../docs/PRIVACIDADE-E-EXCLUSAO.md). Não foi feita exclusão de conta real nem publicação remota automática.

## 1. Criar o projeto

1. Crie um projeto no [painel do Supabase](https://supabase.com/dashboard), escolhendo região próxima dos usuários. A senha do banco fica somente no painel/gerenciador de senhas, nunca no app.
2. Em Authentication, habilite o provedor Email com email/senha. Para cadastro direto solicitado no Arca, deixe Confirm email desligado. A configuração pública do projeto atual foi consultada em 14/10/2026 e já permite entrada sem confirmação. Recuperação de senha ainda exige e-mail/SMTP.
3. No SQL Editor, execute os arquivos abaixo em ordem, uma vez por migration:

| Ordem | Arquivo | Função |
| --- | --- | --- |
| 1 | migrations/202610050001_auth_profiles.sql | Perfil automático, trigger e identidade protegida |
| 2 | migrations/202610060001_learning_schema.sql | Conteúdo, progresso, XP, atividade, recibos e RLS |
| 3 | migrations/202610060002_learning_functions.sql | Conclusão transacional, desbloqueio, XP, streak e importação |
| 4 | migrations/202610060003_leaderboard.sql | Ranking público limitado, posição própria e índice por XP/UUID |
| 5 | migrations/202610060004_learning_journey.sql | Duas unidades, 40 exercícios, progresso agregado e desbloqueio entre unidades; já inclui o seed |
| 6 | migrations/202610070001_varied_exercises.sql | 16 formatos pontuáveis, leituras, conteúdo revisado e compatibilidade com tentativas antigas |
| 7 | migrations/202610080001_expanded_curriculum.sql | 10 unidades, 100 lições, 500 exercícios e compatibilidade com progresso de 5/8 lições; já inclui o seed |
| 8 | migrations/202610140001_ten_exercises.sql | Dez exercícios por lição, 1.000 no total e compatibilidade com tentativas offline anteriores; já inclui o conteúdo |

Se a primeira migration já foi aplicada, não execute novamente: continue pela segunda. A segunda renomeia o campo antigo profiles.xp para xp_total sem descartar valores/perfis. Não rode apenas a segunda em um banco vazio. Cada migration é transacional. O seed pode ser repetido e atualiza os mesmos IDs; não apaga progresso.

Com um projeto vinculado à CLI, a alternativa é aplicar as migrations com supabase db push. A quinta migration já inclui o conteúdo; não exige executar seed.sql separadamente. Não use db reset em um projeto com dados de usuários.

Se as três primeiras migrations já estão aplicadas, execute somente a quarta para habilitar o ranking. Não altere as policies de profiles para permitir SELECT geral. A RPC devolve apenas id/display_name/avatar_key/xp_total/position; anon vê Top 10 e authenticated também recebe sua posição via auth.uid(). O desempate é UUID crescente após XP decrescente. Instruções da atualização e testes: [Ranking, avatares e áudio](../artifacts/RANKING-AVATARES-AUDIO.md).

## 2. Configurar o app

Na pasta arca-mobile, crie .env usando .env.example e preencha:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=SUA_CHAVE_PUBLICA
```

Use Project URL e a chave pública publishable ou legacy anon nas configurações/API do projeto. Nunca use service_role, sb_secret ou senha do banco: todas as variáveis EXPO_PUBLIC são distribuídas no app. .env fica fora do Git.

A variável opcional EXPO_PUBLIC_AUTH_REDIRECT_URL fixa o endereço de confirmação/recuperação por ambiente. Sem ela, Expo Linking deriva o callback do ambiente em execução.

Em Authentication > URL Configuration:

- Cadastre o callback do Expo Go, com o IP/porta reais apresentados pelo Expo: exp://SEU-IP:8083/--/auth/callback.
- Para testar na prévia atual, cadastre http://localhost:8083/auth/callback.
- Em um futuro build próprio, cadastre arca://auth/callback.
- Configure Site URL para sua URL web real; mantenha os templates de email com ConfirmationURL. O endereço específico usado pelo app precisa estar na lista permitida.

Abra o link de confirmação no mesmo ambiente para o qual ele foi enviado. Em Expo Go, mantenha o servidor ativo e o telefone na mesma rede. IP e porta podem mudar, exigindo atualização no painel; um build próprio tem endereço mais estável.

Depois de preencher .env, reinicie o servidor:

```sh
npx expo start --go --clear --port 8083
```

Se a porta estiver ocupada, use outra e atualize os callbacks. Para testar email com usuários externos antes de produção, configure SMTP próprio e os limites de envio do projeto.

Documentação oficial: [Supabase/React Native](https://supabase.com/docs/guides/auth/quickstarts/react-native), [redirecionamentos](https://supabase.com/docs/guides/auth/redirect-urls), [links nativos](https://supabase.com/docs/guides/auth/native-mobile-deep-linking).

## Tabelas e segurança

- profiles: UUID de auth.users, nome, usuário, avatar_key, XP, sequências, última atividade e timestamps. Trigger cria o perfil a partir do cadastro. Avatar_url anterior foi preservado por compatibilidade.
- courses, units, lessons, questions: conteúdo com publicação, ordem e IDs estáveis. Questions.content é JSONB para options/correctAnswer e os campos específicos de cada formato.
- user_lesson_progress: estado available/in_progress/completed/mastered, acertos, precisão, tentativas, XP e conclusão.
- lesson_attempts: respostas e resultado por tentativa; recibo único por usuário/attempt_key.
- xp_events: histórico de XP, único por usuário/lição para esta etapa.
- user_daily_activity: atividade agregada, única por usuário/data.
- guest_progress_imports: recibo único por conta e identificador local de visitante.

Todos usam RLS. Anônimos/autenticados leem somente conteúdo publicado, respeitando também a publicação dos pais. Cada conta lê somente seu perfil, progresso, tentativas, XP, atividade e recibos.

O cliente edita somente nome, usuário e avatar do próprio perfil. Ele não escreve XP, streak, conteúdo oficial ou progresso diretamente. Escritas de progresso acontecem pelas RPCs start_learning_lesson e complete_learning_lesson, que identificam o usuário por auth.uid(). Não aceitam user_id nem XP informado pelo cliente.

A conclusão trava o perfil durante a transação, valida respostas, calcula a pontuação, registra tentativa/evento/atividade, atualiza perfil/progresso e libera a próxima lição. Repetir a mesma tentativa retorna o recibo, sem XP ou atividade duplicados. Revisar com outro ID registra nova tentativa/atividade, mas concede 0 XP.

XP continua: 2 por acerto inicial + 10 por conclusão + 5 por 100% de acertos iniciais, somente na primeira conclusão da lição. Perguntas erradas voltam ao fim da fila, mas as primeiras respostas são mantidas para a pontuação. Conteúdo de leitura não concede acerto/XP. O app nunca usa uma chave administrativa.

Cada repositório usa o token da sua própria conta: uma operação ainda em andamento não pode usar o token de outra pessoa depois de trocar de conta.

## Conteúdo e engine

O seed atual é agregado em src/data/lessons.ts. O conteúdo adicional fica em curriculumFoundations.ts, curriculumOldTestament.ts e curriculumNewTestament.ts; curriculumBuilder.ts monta apresentações tipadas a partir dos fatos explícitos. A engine continua com 16 formatos pontuáveis e content_card, inclusive no servidor. Os currículos de cinco e oito lições permanecem disponíveis para validar progresso e tentativas antigas.

São dez unidades, dez lições por unidade e 1.000 exercícios pontuáveis, com dez perguntas e pelo menos cinco formatos por lição. As cinco práticas complementares ficam em src/data/practiceExercises.ts. Duas lições preservadas também contêm uma leitura seguida de story_summary. Content_card contém body, options vazio e correctAnswer "seen"; o app exige Continuar para registrar leitura e não concede XP pelo cartão. O catálogo completo está em artifacts/CURRICULO-100-LICOES.md.

Para regenerar o seed depois de uma alteração intencional nos dados locais:

```sh
npm run seed:generate
```

Não troque IDs de lições publicadas com progresso existente. O app carrega todas as unidades publicadas do curso biblia-basica. A RPC agrega o progresso do curso mantendo a identidade inicial do contrato/cache. O cliente calcula currentUnitId pela próxima lição. Não foi criada seleção de outros cursos.

Para atualizar um banco que já está com as sete migrations anteriores, execute somente migrations/202610140001_ten_exercises.sql no SQL Editor, depois feche e reabra o app para recarregar o conteúdo. Se a expansão para 100 lições ainda estiver pendente, aplique primeiro a migration 202610080001. A atualização já inclui as perguntas extras e não exige executar seed.sql à parte. Gerar o arquivo local NÃO altera o Supabase remoto. Não use db reset. As migrations anteriores não são reescritas pelo gerador atual. Guia completo: [dez perguntas e cadastro](../docs/DEZ-PERGUNTAS-E-CADASTRO.md).

A expansão preserva os oito IDs, perguntas e conclusões atuais. Novas lições são acrescentadas às duas primeiras unidades; Continuar segue a primeira lacuna na sequência ampliada. A validação aceita um prefixo legítimo do currículo anterior mais conclusões sequenciais do novo. A coluna courses.curriculum_expanded_at registra a data da expansão uma única vez: contas preexistentes podem sincronizar a sequência antiga já respondida offline, sem duplicar XP; novas contas seguem a sequência completa de 100 lições.

## Visitante e migração

Continuar sem conta não cria usuário falso. Mantém o loop inteiro local e o progresso existente em AsyncStorage, chave arca.learning.v1. A escolha de visitante também é lembrada ao reabrir; Sair do modo de visita volta ao login sem apagar aprendizado.

Perfil oferece Salve seu progresso. Quando existe progresso local, essa ação abre o modal Encontramos progresso neste aparelho, com XP, lições concluídas, Importar progresso e Agora não. Uma submissão explícita de cadastro/login também prepara esse convite após autenticar. Recuperar uma sessão ao reabrir o app não mostra o convite espontaneamente. A importação requer conexão, conta autenticada e confirmação; nunca apaga o snapshot visitante.

Importar:

1. Valida a sequência concluída e limites de XP das dez unidades; também aceita prefixos legítimos dos currículos de cinco/oito lições e sua continuação sequencial após a expansão.
2. Mantém todas as lições já concluídas da conta e acrescenta as novas.
3. Não dá XP novamente pelas lições que já estavam concluídas na conta.
4. Registra XP importado em xp_events e um recibo de importação.
5. Só atualiza o cache depois de receber a confirmação do servidor.
6. Nunca remove o snapshot original do visitante.

Um identificador estável da origem local, arca.guest.source.v1, impede reutilizar o mesmo conjunto de progresso em outra conta. Uma conta aceita uma importação inicial. Depois disso, aprendizado logado sincroniza normalmente; novas atividades feitas novamente como visitante continuam independentes e locais.

Limitação importante do legado: ele contém somente XP agregado, IDs concluídos e o último resultado, sem respostas/histórico de pontuação por lição. Por isso a importação não inventa acertos ou precisão: score/accuracy ficam nulos até uma revisão real. O XP agregado é distribuído em ordem, com 10 de base por lição e excedente limitado ao máximo de cada uma; em sobreposição, essa parcela da lição já concluída é ignorada. Sem sobreposição, o total original é preservado.

Não é possível comprovar criptograficamente a pontuação de um protótipo client-only. A RPC limita a importação à unidade/sequência válidas, ao máximo possível, a uma vez por conta e a uma origem única. Não promete proteção antifraude perfeita para dados legados alterados manualmente.

## Persistência, offline e streak

- Sessão: SecureStore com blocos no Android/iOS; armazenamento do navegador na web. Não são guardadas senhas. AuthProvider aguarda recuperação antes de mostrar a navegação, e renova tokens em primeiro plano.
- Visitante: AsyncStorage arca.learning.v1 e conteúdo local original.
- Conta: Supabase é a fonte principal. AsyncStorage arca.account.USER_ID.v1 guarda conteúdo validado, snapshot confirmado, tentativas pendentes e tentativas rejeitadas. Não compartilha progresso com outra conta ou com o visitante.
- Conclusões offline: guarda respostas e ID da tentativa antes de atualizar a interface. XP/desbloqueio aparecem localmente com aviso de pendência; o servidor recalcula e confirma ao reconectar.
- Sincronização: ao abrir, voltar ao primeiro plano, a cada 30 segundos fora de uma lição ativa, e pelo botão Tentar sincronizar. Não modifica o conteúdo de um exercício em andamento.
- Uma resposta perdida depois de o servidor concluir não duplica XP: o mesmo ID é reenviado. O item só sai da fila depois de persistir o recibo.
- Tentativas rejeitadas permanecem guardadas separadamente; o app informa que a lição deve ser refeita. Cache inválido não é apagado silenciosamente; só é substituído após recuperação remota e backup.
- Sem cache de uma conta e com rede indisponível, ela começa com fallback local vazio/pendente, nunca com os dados de outro usuário. Totais remotos reaparecem ao sincronizar. Conteúdo remoto é recarregado ao abrir a conta.
- Streak usa learning_day, calculado no backend em UTC. Revisões também contam como atividade, sem conceder XP novamente. Dias repetidos agregam a mesma linha; um intervalo quebra a sequência atual, preservando a maior.
- Conclusão offline conta no dia em que o servidor confirma, não na data enviada pelo relógio do celular. Migração registra atividade no dia da importação, sem inventar dias passados.

Onboarding, assets e sons continuam locais. Efeitos sonoros podem ser ligados/desligados pelo header do Perfil; a preferência persiste em AsyncStorage. Respostas de exercícios ainda não concluídos continuam somente na memória, como antes; fechar no meio de uma lição reinicia a tentativa. Ranking depende da quarta migration; avatar_key referencia PNG local, sem imagem no banco. O mascote tem poses separadas de pensamento, leitura e celebração.

## Roteiro de teste após configurar

1. Sem .env, entre como visitante, conclua uma lição, anote XP e feche/reabra: trilha e XP persistem. Confira sons/haptics no Android.
2. Com migrations, seed e .env configurados, use Salve seu progresso, cadastre email/senha, confirme o email e entre. O perfil deve aparecer automaticamente no banco.
3. Aceite Salvar progresso na conta. Compare lições/XP; confira guest_progress_imports e xp_events. Repita sincronização/reabra: não deve somar XP outra vez.
4. Conclua a próxima lição online. Confira resultado, desbloqueio, user_lesson_progress, lesson_attempts, xp_events, profiles.xp_total e a linha de atividade de hoje.
5. Revise uma concluída: +0 XP, tentativas aumentam, atividade conta uma conclusão, sem novo xp_event.
6. Feche totalmente o Expo Go e abra de novo sem limpar armazenamento: sessão recuperada, sem passagem pelo login, progresso confirmado igual. Em outro aparelho, a mesma conta deve recuperar os mesmos dados.
7. Depois de carregar a conta, desligue a internet e conclua uma lição. Confira aviso pendente, feche/reabra offline, reconecte e sincronize. Compare o total do app com o servidor e confirme que a fila esvaziou.
8. Edite nome/usuário, reabra e confira. Faça logout: volta ao login, sem remover progresso. Entre com uma segunda conta: não deve aparecer XP/cache da primeira nem uma importação silenciosa.
9. Teste nova atividade em dias consecutivos UTC: streak aumenta. Dois acessos no mesmo dia não criam dias extras; dias sem atividade quebram a sequência. Não altere o relógio do aparelho para testar o backend.
10. Teste login inválido, confirmação expirada, recuperação de senha e indisponibilidade da rede. No SQL Editor, não use a sessão administrativa para avaliar RLS: ela ignora as policies; os testes automatizados usam as roles reais.

## Validação automatizada

```sh
npm run typecheck
npm run lint
npm test
npx expo export --platform android --output-dir dist/android
```

tests/database.test.ts executa as seis migrations e o seed em PostgreSQL real via PGlite (somente desenvolvimento), com roles anon/authenticated e auth.uid simulado. tests/journey.test.ts também atualiza um banco com progresso antigo e verifica que conteúdo, recibos, XP, streak e avatar foram preservados. Não substitui Supabase Auth/REST/email nem um teste em Android físico.

## Atualizar a jornada existente

Se as quatro migrations anteriores já foram aplicadas, execute SOMENTE migrations/202610060004_learning_journey.sql no SQL Editor. Ela atualiza conteúdo e funções em uma transação, sem apagar perfis ou progresso. Depois feche/reabra a versão atualizada do app para carregar as duas unidades. Não reaplique as migrations anteriores, não execute o seed antigo e não use db reset.

tests/accountLearning.test.ts cobre caches isolados, fila offline, reabertura, recibo perdido, falha de disco, quarentena, backup, importação sem apagar visitante e token por conta.

## Atualizar os formatos de exercício

Se as cinco migrations anteriores já estiverem aplicadas, execute somente migrations/202610070001_varied_exercises.sql. Não reaplique as antigas, não execute o seed antigo e não use db reset. Em um banco novo, aplique as seis na ordem da tabela. A migration inclui o conteúdo atual; seed.sql separado é opcional e idempotente.

A atualização conserva IDs de unidades/lições e dados dos usuários. Perguntas antigas recebem order_index >= 1000; as atuais ficam abaixo de 1000. O app consulta apenas as atuais. A função de conclusão aceita versões completas antigas ou novas para não rejeitar tentativas legítimas que já estavam offline; não mistura versões nem duplica recompensas. A importação considera somente os cinco exercícios ativos por lição.

O gerador não reescreve as migrations históricas. Ele atualiza seed.sql, templates/varied-exercises.sql e a sexta migration ainda não publicada. Depois de aplicar/publicar essa migration, futuras mudanças exigem outro arquivo, não edição do histórico.

Nenhuma migration foi executada no projeto remoto nesta rodada. Novos tipos em contas dependem da sexta migration; visitante usa os dados locais atualizados. Cadastro/login/logout remoto e Android físico não foram testados aqui. Confira o relatório [Refinamento de produto](../artifacts/REFINAMENTO-PRODUTO.md).
