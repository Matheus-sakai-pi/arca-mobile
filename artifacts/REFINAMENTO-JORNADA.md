# Refinamento visual e expansao da jornada

## Entrega

Base Expo SDK 57 preservada, sem novas dependencias nativas. Autenticacao, ranking real, perfil, fila offline, sons/haptics, XP e streak continuam usando os servicos existentes. Nenhuma credencial privada foi utilizada, nem dado remoto foi alterado nesta entrega.

Fundo de Aprender agora monocromatico, usando colors.background. A imagem journey-desert.png permanece no repositorio, mas nao e mais consumida pela tela. Sem cenario grande, sem blobs e sem imagens remotas.

Moedas geradas com transparencias reais: prata para disponivel; ouro para concluida; prata com aro azul para atual; cinza fosco para bloqueada. Check/play/cadeado Lucide em badges e rotulos escritos mantem estados claros sem depender apenas da cor. A geometria base nao muda quando o estado muda.

Acabamento: botoes com borda inferior de profundidade, respostas/chips com limites mais definidos, barra de progresso com brilho discreto, separadores e hierarquia nas telas de exercicio, ring no avatar do perfil, pedestais do ranking com relevo e bordas. Nunito, paleta, navegacao e comportamento do feedback foram preservados. Streak e XP aparecem juntos em Home, Aprender, Ranking e Perfil. O streak exibido e o confirmado pelo backend; visitante sem historico de streak mostra zero, nao uma sequencia inventada.

## Arquivos principais alterados ou criados

- src/data/lessons.ts: duas unidades, 15 exercicios novos, helpers combineUnits/journeyUnits; IDs e textos antigos preservados.
- src/lib/learningProgress.ts: jornada entre unidades, leitura segura do progresso legado, identificador da unidade atual.
- src/lib/backendDecoders.ts: snapshot agregado e validacao de progresso antigo.
- src/lib/accountLearningStore.ts: cache multiunidade e preservacao de tentativas antigas na fila.
- src/services/learning.ts: carrega as unidades publicadas do curso em tres consultas de conteudo; nenhuma busca de participantes do ranking adicionada.
- src/app/(tabs)/learn.tsx: secoes das duas unidades e fundo monocromatico.
- src/components/learning/JourneyTrail.tsx, JourneyNode.tsx: moedas e companheiros responsivos; estados e clique preservados.
- src/lib/journeyLayout.ts: posicionamento lateral dos personagens com a largura medida.
- src/constants/trailAssets.ts: requires estaticos das moedas e personagens.
- src/components/learning/LearningStats.tsx: indicador compartilhado de streak e XP.
- src/app/(tabs)/home.tsx: avatar, metricas e progresso da unidade da proxima licao.
- src/components/learning/LearningTrail.tsx: resumo da unidade atual na Home.
- src/app/(tabs)/profile.tsx, ranking.tsx: acabamento e metricas compartilhadas.
- src/components/leaderboard/LeaderboardPodium.tsx: ring e profundidade dos pedestais.
- src/components/common/Button.tsx: acabamento dos botoes.
- src/components/learning/ProgressBar.tsx, QuestionOptions.tsx, questions/QuestionParts.tsx, LessonPlayer.tsx: acabamento das perguntas e feedback, sem alterar a logica sonora.
- src/constants/avatarKeys.ts, avatars.ts: dez avatares reais, mantendo os cinco humanos.
- scripts/generate-seed.ts: gera seed e migration da jornada a partir dos dados e template.
- supabase/templates/journey-functions.sql: snapshot do curso, desbloqueio entre unidades e importacao legada segura.
- supabase/migrations/202610060004_learning_journey.sql: atualizacao atomica de conteudo e funcoes, sem DELETE de perfis/progresso.
- supabase/seed.sql: oito licoes, 40 exercicios; atualizacoes pelos mesmos IDs.
- tests/learning.test.ts, accountLearning.test.ts, database.test.ts, leaderboard.test.ts; novo tests/journey.test.ts e fixture SQL tests/legacy-seed.sql.
- README.md, supabase/README.md, assets/GENERATED-JOURNEY-ASSETS.md e este relatorio.

Nao foram modificados os providers de Auth, o hook de audio, os arquivos WAV, os cinco avatares humanos, as migrations anteriores, nem os arquivos sincronizados em sources/.

## Assets novos

assets/ui/trail-coin-silver.png
assets/ui/trail-coin-gold.png
assets/ui/trail-coin-current.png
assets/ui/trail-coin-locked.png

assets/characters/owl.png
assets/characters/lamb.png
assets/characters/fox.png
assets/characters/dove.png
assets/characters/turtle.png

Ferramenta integrada de geracao de imagens, um asset por chamada. A moeda de prata foi a matriz das outras tres variantes. A direcao artistica usa formas arredondadas, acabamento cartoon polido, expressoes amigaveis e fundos transparentes. Os prompts finais estao em assets/GENERATED-JOURNEY-ASSETS.md. Os arquivos foram copiados sem alterar o alpha; originais da ferramenta foram preservados.

O leao sugerido falhou em duas tentativas de geracao. Como o conjunto permitia ajustes, o quinto personagem foi uma tartaruga, nao um placeholder nem um arquivo de outro personagem chamado lion.png.

## Posicionamento

journeyGeometry continua calculando centro/esquerda/direita a partir de onLayout. A sequencia global continua entre unidades: centro, esquerda, direita, centro, esquerda, direita, centro, esquerda.

journeyDecoration escolhe o lado oposto ao no: curva esquerda -> personagem direita; curva direita -> personagem esquerda. Nos centrais nao recebem personagem. Os cinco companheiros aparecem nas cinco curvas desta jornada.

O grupo de moeda/nome/CTA tem largura entre 144 e 180 pontos, limitada pela largura do container. O personagem usa ate 104 pontos e apenas o espaco livre dessa faixa, com 16 pontos reservados de separacao. Se nao houver 56 pontos disponiveis, a decoracao e omitida. Isso permite telas pequenas/ampliacao sem empurrar ou cobrir controles. Personagens ficam em Views de fluxo flex com pointerEvents=none e escondidos da acessibilidade; nao capturam clique. Apenas o badge dentro da moeda usa posicionamento absoluto, relativo a um componente com dimensoes estaveis.

## Conteudo

Unidade 1 - Conhecendo a Biblia:

1. O que e a Biblia? - 5 exercicios.
2. Antigo e Novo Testamento - 5.
3. Como a Biblia e organizada - 5.
4. Revisao - 5.

Unidade 2 - Personagens e Historias Fundamentais:

1. Personagens importantes - 5.
2. Dos comecos a promessa - 5.
3. Moises e Davi - 5.
4. Jesus e os primeiros cristaos - 5.

Total: exatamente 20 exercicios por unidade, 40 no curso. Cada licao mistura cinco tipos; todos os sete tipos existentes aparecem na jornada. Explicacoes curtas apresentam o conteudo como narrativas biblicas, sem assumir um canon denominacional especifico.

Os 25 exercicios anteriores NAO foram substituidos: mesmos IDs, perguntas, solucoes e explicacoes. Personagens importantes foi movida para a unidade 2 e Revisao passou a fechar a unidade 1. Foram adicionados 15 exercicios em tres novas licoes. A migracao conserva conclusoes antigas, inclusive o caso de Personagens importantes concluida antes de Revisao. Revisar uma licao movida continua concedendo zero XP. Uma licao desbloqueada antes da mudanca permanece finalizavel pelo backend, inclusive uma tentativa que estava na fila offline.

## Avatares e persistencia

Chaves adicionais: owl, lamb, fox, dove, turtle. AvatarKey e inferido do registro avatarKeys.ts; avatars.ts converte cada chave para require estatico do MESMO PNG usado na decoracao.

Selecao usa o modal existente, agora com dez opcoes rolaveis. A mutation existente salva somente avatar_key no proprio perfil, com confirmacao do servidor e cache AsyncStorage por UUID. Perfil, Ranking e Home usam o mesmo mapper/provider. Nao ha upload/download de imagem, novo Storage ou reload de unidade ao trocar avatar. Sem conta autenticada, nao fingimos persistir no Supabase.

Progresso de visitante continua em arca.learning.v1; a leitura reconhece as sequencias antigas e normaliza apenas a ordem/identificador da unidade, mantendo XP/resultados/conclusoes. Cache de conta e fila continuam isolados por UUID. currentUnitId identifica a unidade da proxima licao. Internamente, initialUnit/unit continuam sendo a visao linear da jornada com identidade raiz antiga, para nao reestruturar contratos e armazenamento sem necessidade; journeyUnits agrupa as licoes pelos seus unitId reais.

## Etapa manual obrigatoria

Consulta publica somente de leitura ao Supabase configurado confirmou apenas conhecendo-a-biblia publicada. A nova migration NAO foi aplicada remotamente.

Se as quatro migrations anteriores ja estao aplicadas, execute SOMENTE supabase/migrations/202610060004_learning_journey.sql no SQL Editor do projeto correto. Ela inclui o conteudo e as funcoes em uma transacao; nao precisa executar seed.sql depois. Nao reaplique migrations antigas, nao execute o seed legado e nao use db reset.

Para banco novo, siga as cinco migrations em ordem conforme supabase/README.md. Depois feche/reabra a versao atualizada no Expo Go para carregar o novo conteudo da conta. Visitante ja recebe as duas unidades locais. Nao altere uma migration aplicada no futuro: expansoes seguintes precisam de nova migration.

## Verificacoes realizadas

- TypeScript e lint: passaram, zero warnings relevantes.
- 98 testes: passaram. Incluem PostgreSQL real em memoria/PGlite, RLS, XP idempotente, streak, ranking, todos os avatares, sequencia de duas unidades e regressao de migracao com progresso legado.
- A regressao do banco conferiu igualdade das 25 perguntas antigas, recibos, XP, streak e avatar antes/depois da migration. Tambem confirmou 20/20, revisao movida sem XP extra, conclusao antiga pendente e bloqueio de unidade 2 para conta nova.
- Export Android Hermes: passou; dist/journey-android, 3732 modulos e 48 assets, incluindo todos os nove PNGs novos e ambos os WAVs. Nenhuma dependencia nativa adicionada.
- UI real em 320x568 e 390x844: trilha sem overflow horizontal, assets carregados, clique bloqueado mostra aviso, lição disponivel abre, selecao habilita Verificar, feedback/Continuar e sair/retornar funcionam. Nenhuma licao foi concluida na conta real nem alterado seu XP durante essa verificacao.
- Seletor: os cinco novos avatares foram selecionados e salvos numa fixture visual explicita; confirmacao imediata no ranking de teste. A rota temporaria foi removida e nunca esteve no export final. Persistencia/permissoes reais foram testadas no PostgreSQL local; conta remota autenticada ainda deve ser validada pelo usuario.
- Servidor Expo na porta 8084, manifesto Android SDK 57 retornou endereco de rede 192.168.101.191:8084. Sem Android fisico/adb acessivel: nao foi realizado teste nativo auditivo/haptic ou de botao voltar do aparelho nesta sessao.

Screenshots: artifacts/journey-320.png, journey-390.png, unit-two-320.png, exercise-320.png, home-refined-320.png, characters-avatar-390.png e ranking-refined-320.png. As duas ultimas usam participantes SOMENTE de teste, nunca inseridos no ranking publicado.

## Testar no Android

1. Aplicar somente a nova migration se o backend anterior esta provisionado.
2. Com computador e celular na mesma rede, abrir exp://192.168.101.191:8084 no Expo Go compativel com SDK 57. Esse IP pode mudar. Para iniciar outro servidor: npx expo start --go --clear; usar o QR desse servidor. Previa web atual: http://localhost:8084/learn.
3. Reabrir a conta e conferir XP, streak, avatar e licoes antigas; nao limpar armazenamento nem desinstalar para testar preservacao.
4. Em conta de teste nova, apenas a primeira licao fica disponivel. Tocar bloqueada nao navega. Concluir as quatro da unidade 1 libera a segunda, com moedas douradas e proximo passo destacado.
5. Concluir as oito licoes, alternando acertos/erros, conferir XP/resultados e retornar a trilha. Revisar deve conceder zero XP adicional. Conferir sons e haptics no aparelho, nos sete formatos.
6. Perfil > Escolher avatar: manter opcoes humanas, testar os cinco companheiros, Salvar, conferir Perfil/Home/Ranking e reabrir para persistencia. Sem rede, a falha nao pode substituir o avatar salvo.
7. Rolar toda a trilha e modal em Android pequeno; textos, moeda, CTA e botao Salvar precisam continuar acessiveis. Personagens nao devem interceptar toques.

Documentacao consultada: https://docs.expo.dev/versions/v57.0.0/ e https://docs.expo.dev/versions/v57.0.0/sdk/image/ . As imagens usam o componente React Native ja existente no app, sem adicionar expo-image.
