# Arca Mobile

Aplicativo React Native com Expo SDK 57, TypeScript estrito e Expo Router. Inclui o loop de aprendizado, 100 lições em dez unidades com 100 exercícios cada, modo visitante local, integração real com Supabase Auth/PostgreSQL, ranking por XP e dez avatares locais. As migrations precisam ser aplicadas no projeto remoto configurado.

Checklist atualizado: [status do produto](docs/STATUS-DO-PRODUTO.md). Novos recursos e roteiro: [refinamentos 0.2.0](docs/REFINAMENTOS-AUTONOMOS.md). Segurança e backup: [revisão técnica](docs/SEGURANCA-E-BACKUP.md).

AAB atual: `artifacts/releases/arca-0.4.0-versionCode-7.aab` (fora do Git), gerado em 17/10/2026 pelo EAS (build 6298bf18). Versão 0.4.0 / versionCode 7, pacote com.arca.mobile, mesmo certificado das versões anteriores (SHA-256 9D:D0:4F:7D:…:C9:5A). Imagens de 78,8 MB para 19,2 MB no bundle. O Supabase remoto já recebeu `artifacts/supabase-2026-10-18/ATUALIZAR-SUPABASE.sql`. Não enviado à Play Store; próximos passos em [docs/PROXIMOS-PASSOS.md](docs/PROXIMOS-PASSOS.md).

Guia do backend: [supabase/README.md](supabase/README.md). Currículo atual: [100 lições](artifacts/CURRICULO-100-LICOES.md). Histórico do ranking e diagnóstico do áudio: [artifacts/RANKING-AVATARES-AUDIO.md](artifacts/RANKING-AVATARES-AUDIO.md).

Atualização de dez perguntas, repetição dos erros e cadastro sem confirmação: [instruções e testes](docs/DEZ-PERGUNTAS-E-CADASTRO.md). Para o banco existente, aplique apenas `202610140001_ten_exercises.sql` depois das migrations anteriores. A configuração pública do Supabase foi consultada em 14/10/2026: confirmação de e-mail já desativada.

Privacidade e exclusão de conta: [publicação e testes](docs/PRIVACIDADE-E-EXCLUSAO.md). O Perfil e o cadastro/login oferecem a política; a exclusão verifica sessão e senha pelo servidor. O proprietário publicou as páginas em `arca-politica.netlify.app` e relatou a publicação da função `delete-account`. O teste real de exclusão continua pendente; o texto atualizado em `legal-site/dist` precisa ser republicado no mesmo site. Nenhuma conta real foi excluída nesta implementação.

## Escopo entregue

- Estrutura em `src/app`, `components`, `providers`, `hooks`, `services`, `lib`, `types` e `constants`.
- Tokens de cores, tipografia Nunito, espaçamento, raios, sombras e dimensões. Azul, fundo claro e superfícies arredondadas baseados nas três referências anexadas.
- Componentes de texto, botões, campos, avisos e estados de carregamento, erro e vazio; áreas de toque acessíveis e suporte a ampliação de texto.
- Splash, quatro telas de onboarding, indicadores interativos, avançar, pular e preferência persistida.
- Login, cadastro, confirmação/reenvio de e-mail, recuperação de senha por link, nova senha e logout pelo Supabase Auth.
- Sessão persistida no SecureStore no Android/iOS, dividida em blocos para suportar tokens grandes; armazenamento do navegador na versão web. AsyncStorage guarda a preferência de onboarding e o progresso de aprendizado local.
- Rotas protegidas, tratamento de links recebidos com o app aberto ou fechado, renovação de sessão no primeiro plano e navegação com quatro abas.
- Modo visitante com escolha e aprendizado persistidos, sem criar usuário ou sessão falsa. Perfil oferece Salve seu progresso para cadastro/login.
- Aba Perfil usa os dados da conta, edição de identidade, XP, sequência, recuperação de senha e logout.
- Mascote PNG transparente gerado a partir da referência, com registro tipado de expressões futuras. Por enquanto, todas apontam para o asset base.
- Migrations de perfil, conteúdo, progresso, tentativas, XP, atividade diária e importação. RLS e operações transacionais validam pontuação/desbloqueio/XP no servidor.

## Loop de aprendizado local

- Dez unidades de dez lições com dez exercícios em cada lição: 1.000 questões no total. As cinco perguntas existentes foram preservadas e cinco práticas complementares reforçam os fatos de cada tema em formatos variados. A unidade atual abre por padrão na trilha; os cabeçalhos permitem abrir e recolher outras unidades sem transformar as lições em lista.
- Trilha compartilhada entre Início e Aprender, com lições bloqueadas, disponíveis, atuais e concluídas. Apenas a primeira começa disponível; concluir uma libera a próxima. As rotas também verificam o bloqueio.
- Engine de tentativa em `src/lib/lessonEngine.ts`, avaliadores em `src/lib/questionEngine.ts` e contratos discriminados em `src/types/learning.ts`. QuestionRenderer mantém os 16 formatos existentes e content_card (leitura sem acerto/XP). Os dados locais permanecem como fallback/visitante; para contas, o conteúdo vem do banco, com paginação para carregar todos os 1.002 registros ativos. A nova migration preserva os 500 exercícios anteriores e acrescenta 500, sem substituir seus IDs.
- Verificar só é habilitado com resposta completa: uma alternativa/palavra, pelo menos uma seleção, todos os pares ou todos os eventos. Feedback trava a resposta, destaca acertos/erros, mostra a solução e explicação, animação com respeito à redução de movimento, som local e haptic nativo de sucesso/erro. Associação e ordenação contam como um exercício, sem XP parcial por item; seleção múltipla exige o conjunto exato.
- Lacunas usam o marcador `{{blank}}` e chips de palavras. Associação usa duas colunas, seleção esquerda/direita e identificação comum dos pares; é possível refazer um par antes de verificar. Ordenação usa toque para preencher posições, setas para mover e remover para devolver um item às opções, sem dependência de drag-and-drop. Personagens começam com uma pista e revelam outras por toque; o número de pistas não altera o XP.
- Cada exercício começa no topo da área rolável e aparece com uma transição curta. Trocar de pergunta limpa apenas seu estado de interação, sem recriar os players de áudio nem mexer no progresso salvo.
- Perguntas erradas retornam ao fim da fila até serem corrigidas. A barra conta exercícios acertados, de 0 a 100%, e a etapa de revisão mostra as pendências. Resultado mantém a precisão da primeira resposta. Continuar retorna à trilha.
- XP: +2 por acerto na primeira resposta, +10 por concluir e +5 por 100% de acertos iniciais. Assim, 8/10 recebe 26 XP e 10/10 recebe 35 XP. Repetições dentro da tentativa não acrescentam XP. Apenas a primeira conclusão concede XP; revisões mostram o resultado e +0 XP. Resultados anteriores de cinco perguntas continuam válidos.
- Persistência local em AsyncStorage, chave `arca.learning.v1`: versão do schema, unidade atual, IDs das lições concluídas, XP total e último resultado. O snapshot inteiro é salvo antes de abrir o resultado, com gravações serializadas, proteção contra duplicação e validação na leitura. Falhas não apagam dados e permitem tentar novamente.
- Visitante mantém seu progresso neste aparelho em arca.learning.v1. Contas usam o Supabase como fonte principal, cache separado por UUID e fila de conclusões offline. Migração é oferecida após login/cadastro e nunca apaga o visitante. Fechar mantém conclusões/XP; tentativas interrompidas são persistidas e retomadas no mesmo aparelho, com respostas, feedback e fila de revisão.
- Início mostra avatar, streak/XP reais, lição seguinte e progresso da unidade correspondente. Após as 100 lições, Revisar abre a última. Todas as concluídas também podem ser revisitadas na trilha.

Streak de contas é calculado por datas UTC do backend; XP e revisões são validados no servidor. Ranking usa a RPC learning_leaderboard: Top 10 e posição própria, XP decrescente e UUID crescente nos empates. Exibe apenas dados públicos necessários, sem abrir RLS geral dos perfis. Não há vidas, notificações, pagamentos, IA, loja ou grupos. O mascote de resultado reutiliza o PNG existente: a pose específica de celebração ainda não tem asset próprio.

## Ranking e avatares

Pódio 2/1/3 com medalhas Lucide, linhas 4-10, destaque da conta atual e Sua posição quando fora do Top 10. Estados reais de carregamento, vazio, falha e pull-to-refresh, sem participantes mockados. Execute a nova migration `202610060003_leaderboard.sql` se o backend anterior já está pronto; não reaplique as anteriores. Na verificação desta etapa o servidor configurado retornou PGRST202, indicando RPC ainda ausente.

Perfil oferece Escolher avatar para contas autenticadas. Os cinco PNGs humanos em assets/avatars e os cinco personagens em assets/characters são locais e reais. Geração documentada em assets/GENERATED-JOURNEY-ASSETS.md e no README dos avatares humanos. Salvar atualiza somente avatar_key; o provider compartilhado e o cache por conta refletem a alteração sem recarregar progresso ou conteúdo. Chaves antigas/desconhecidas usam avatar-01. Novas opções são adicionadas ao registro avatarKeys.ts e ao mapa de requires em avatars.ts.

No áudio, o controlador agora consome erros enviados por playbackStatusUpdate no Android, que não aparecem em currentStatus.error. Uma fonte falha é recarregada uma vez e as fontes saudáveis continuam reutilizadas. A confirmação auditiva em Android físico permanece necessária; não há aparelho conectado nesta sessão.

### Teste manual do fluxo

1. Abra pelo Expo Go e use Continuar sem conta na tela de login, se não houver autenticação configurada.
2. Em Início, confira 0 XP e 0/10 concluídas na primeira unidade numa instalação sem progresso; apenas a lição 1 deve estar disponível. Toque em Continuar.
3. Verifique que Verificar fica desativado antes da seleção. Escolha uma resposta errada e veja Quase!, a alternativa correta, a explicação e o haptic. Continue e responda as demais.
4. Confira dez exercícios e o avanço de 10% a cada pergunta corrigida. As erradas voltam ao final até serem acertadas. Antes de acabar, experimente Sair da lição, cancele a confirmação e continue. O botão voltar do Android também pede confirmação.
5. Complete a lição. Confira acertos, precisão e XP conforme a fórmula. Continue: a lição 1 aparece concluída e a lição 2 atual/liberada.
6. Volte ao Início: XP e contagem foram atualizados e Continuar abre a lição 2. Feche e reabra o app; a escolha de visitante é lembrada, com os mesmos valores.
7. Conclua dez lições: a primeira unidade termina em 10/10 e a segunda é liberada. O mesmo vale para as próximas unidades; após 100 conclusões, o botão do Início vira Revisar. Faça uma com todas corretas para conferir o bônus.
8. Repita uma lição concluída: o resultado deve mostrar +0 XP e o total não mudar. Ao abandonar uma tentativa antes de concluir, não há recompensa nem desbloqueio.

## Sons e jornada de Aprender

- A aba Aprender usa uma jornada vertical original com passos circulares: centro, esquerda, direita, centro, esquerda, direita, repetindo conforme o índice. O Início permanece com o visual anterior.
- `JourneyTrail` mede a largura disponível com `onLayout`; `journeyLayout.ts` calcula a largura responsiva dos grupos de nó/nome/ação, entre 144 e 180 pontos, limitada ao espaço disponível. O alinhamento ocorre no fluxo normal do layout, sem posições absolutas. Conectores SVG usam essa mesma medida. A ScrollView existente permite percorrer toda a unidade.
- Concluída: check e preenchimento verde; atual: nó maior azul com aro dourado e Continuar; disponível: azul com Começar; bloqueada: cadeado dessaturado. Tocar numa bloqueada mostra a lição necessária e uma animação curta, sem navegar. Redução de movimento é respeitada.
- `expo-audio` 57.0.5, instalado pelo Expo para este SDK, pré-carrega dois players locais e os reutiliza durante a lição. Cada resposta reinicia o player adequado no instante zero, sem aguardar o áudio na interface. Ao sair, desativar efeitos ou colocar o app em segundo plano, a reprodução pendente é cancelada. O hook libera os players quando desmonta.
- Os efeitos originais já estão incluídos: `assets/sounds/correct.wav` (0,48 s, notas ascendentes) e `assets/sounds/wrong.wav` (0,36 s, notas suaves descendentes). Nenhum arquivo falta; não são placeholders nem URLs externas. Veja `assets/sounds/README.md` para substituir por outros WAV/MP3 ou regenerar os arquivos.
- `src/constants/sounds.ts` centraliza fontes, volume e `enabledByDefault: true`. Para uma preferência futura, passe o booleano a `useLessonSounds(enabled)`. Configurações agora permitem ajustar som, vibração, redução de movimento e meta diária, com persistência por conta/visitante.
- O áudio usa a saída de mídia, inclusive no modo silencioso/vibrar do Android, mistura com outros áudios e não exige microfone, gravação ou reprodução em segundo plano. Volume de mídia zero ou efeitos desligados continuam sem som. Falhas do áudio não impedem verificação, haptic, animação, XP ou navegação. O plugin desabilita permissões/serviços de gravação e background em futuros builds próprios.
- O refinamento de sons/jornada preservou conteúdo, fórmula de XP, desbloqueio e chave de progresso local. A integração posterior com Supabase acrescenta avaliação remota e content_card, sem substituir os exercícios.

### Fundo da trilha e confiabilidade do áudio

- Somente Aprender usa `assets/illustrations/journey-desert.png`, cópia intacta da imagem fornecida. O fundo fica fixo atrás da área rolável, com `Image` em `cover`, sem esticar: telas com proporções diferentes podem recortar as bordas. Há uma camada branca de 28%, uma faixa translúcida no cabeçalho e fundos discretos nos nomes das lições. O fundo não recebe toques nem aparece na árvore de acessibilidade. Outros usos de Screen e JourneyTrail permanecem com o visual anterior.
- Os players de acerto/erro continuam separados e pré-carregados. Se o player selecionado ainda estiver carregando ou bufferizando, o controlador aguarda prontidão por evento de áudio, com consulta de segurança e limite de dois segundos, sem bloquear a interface. Uma verificação nova, saída, segundo plano ou efeitos desligados cancelam esperas e removem os listeners. Uma falha ao pausar o player oposto não impede o escolhido de tocar.
- A reprodução mantém pausa, `seekTo(0)` aguardado e `play()` do mesmo player. Falhas reais de carga/decoder são registradas em desenvolvimento, em vez de desaparecerem silenciosamente; não impedem a lição. Os testes reproduzem cinco erros consecutivos com carga atrasada e a prévia registrou cinco inícios/fins do som de erro, seguidos por um acerto. Confirmação auditiva em Android físico ainda é necessária.
- Relatório e roteiro: [artifacts/FUNDO-AUDIO-VERIFICACAO.md](artifacts/FUNDO-AUDIO-VERIFICACAO.md).

### Teste manual dos refinamentos no Android

1. Na pasta do app, execute `npx expo start --go` e abra o QR code no Expo Go compatível com SDK 57. Após instalar dependências novas, reinicie um servidor antigo.
2. Ative o volume de mídia para ouvir os efeitos, inclusive com o telefone no modo silencioso/vibrar. Em Aprender, confira o zigue-zague, os nomes e os quatro estados conforme seu progresso.
3. Toque numa lição bloqueada: ela deve oscilar discretamente e mostrar o requisito, sem abrir. Role até o último passo e confira que a mensagem cabe acima da navegação.
4. Abra uma disponível/atual. Escolha uma resposta errada, verifique e ouça o efeito suave; veja Quase!, explicação e haptic. Continue e acerte outra: ouça a recompensa, veja Correto! e haptic. Repita acertos para conferir a reutilização do player.
5. Conclua a lição, confira o XP, volte à jornada e veja o check e a próxima lição atual. Abra a próxima pelo nó ou CTA.
6. Saia de uma tentativa ou minimize o app durante o feedback: nenhum som deve continuar em segundo plano. Feche e reabra o app e confira que conclusões, desbloqueios e XP permanecem. Revisar concluídas não concede XP novamente.
7. Abra Configurações, desative Efeitos sonoros e confirme que feedback visual e XP continuam funcionando. Reabra o app para verificar a persistência. A vibração pode ser desligada separadamente.

## Instalar e rodar

Requisitos: Node.js 22.13 ou superior e npm. O projeto foi criado com Node 24.

```sh
cd arca-mobile
npm ci
npm start
```

O Expo abre o servidor de desenvolvimento e apresenta o QR code. Para a versão web:

```sh
npm run web
```

Sem `.env`, onboarding e modo de visita funcionam. Cadastro e login exibem a indisponibilidade do serviço, sem simular autenticação.

## Configurar Supabase

1. Crie um projeto Supabase e habilite Email em Authentication > Providers.
2. Em um banco novo, execute as sete migrations em ordem, terminando em `202610080001_expanded_curriculum.sql`, que já inclui o conteúdo. Em um banco existente, execute apenas migrations ainda não aplicadas. Não reaplique as migrations antigas nem use db reset. Veja o guia detalhado em supabase/README.md.
3. Crie `.env` a partir de `.env.example` e preencha:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=SUA_CHAVE_PUBLICA_ANON_OU_PUBLISHABLE
```

Use somente a chave pública, nunca `service_role` ou uma chave secreta. Variáveis `EXPO_PUBLIC_*` são incluídas no app. `.env` está ignorado no Git.

4. Em Authentication > URL Configuration, adicione os callbacks usados pelos ambientes:

```text
arca://auth/callback
http://localhost:8083/auth/callback
```

Para Expo Go, adicione também o endereço completo de retorno da sessão de desenvolvimento, por exemplo `exp://192.168.1.10:8083/--/auth/callback`, ajustado ao endereço exibido pelo Expo. Links com scheme próprio são mais confiáveis em um development build.

5. Configure Site URL para o ambiente web correto e mantenha os templates padrão com `{{ .ConfirmationURL }}` para confirmação e recuperação. O app consome os tokens do link e limpa o fragmento da URL no navegador. Há uma variável opcional `EXPO_PUBLIC_AUTH_REDIRECT_URL` para fixar um callback por ambiente.
6. Reinicie o Expo após alterar `.env`, usando `npx expo start --go --clear --port 8083`. Se escolher outra porta, atualize a lista de redirecionamentos.
7. Para produção, configure o envio de e-mails no Supabase e verifique os limites de envio do seu projeto.

profiles usa o UUID do usuário como chave estrangeira. O cliente lê somente seus dados e edita a própria identidade. Progresso/XP/streak são escritos por RPCs protegidas, nunca por atualização direta do cliente. As três migrations foram testadas em PostgreSQL local com RLS; aplicação remota e fluxos reais de email dependem de um projeto Supabase configurado e ainda não foram executados.

### Seed

supabase/seed.sql insere curso, dez unidades, 100 lições e 1.000 exercícios de src/data/lessons.ts, com IDs antigos preservados. Requer todas as migrations, inclusive `202610140001_ten_exercises.sql`. npm run seed:generate regenera o seed, o catálogo e essa nova migration; não reescreve as migrations anteriores. Perfis são provisionados pelo cadastro em Supabase Auth; nunca insira senhas em SQL.

## Expo Go e Android

Execute `npx expo start --go` e escaneie o QR code com uma versão compatível com SDK 57. O telefone deve conseguir alcançar o servidor, normalmente pela mesma rede Wi-Fi. Para limpar um cache antigo, use `npx expo start --go --clear`. O projeto não depende de Android Studio para usar Expo Go. As novas telas usam módulos incluídos no Expo Go: AsyncStorage, Haptics, Reanimated, SVG e Expo Audio.

Para um development build com suporte completo ao scheme `arca`:

```sh
npx eas-cli@latest login
npx eas-cli@latest build:configure
npx eas-cli@latest build --platform android --profile development
```

Depois de instalar o APK de desenvolvimento:

```sh
npx expo start --dev-client
```

O `eas.json` contém os perfis `development`, `preview` (APK) e `production` (AAB, ambiente EAS production). O identificador inicial é `com.arca.mobile`; confirme sua disponibilidade antes do primeiro envio ou preserve o package/chave de upload se já existir uma versão na loja. Vincule o projeto EAS e configure as variáveis públicas na sua conta EAS. O perfil de envio `internal` usa apenas teste interno em rascunho, sem lançamento público automático.

```sh
npx eas-cli@latest build --platform android --profile preview
npx eas-cli@latest build --platform android --profile production
```

O roteiro de [teste interno e pendências para lançamento público](docs/PLAY-STORE.md) registra os próximos passos. O primeiro build remoto concluiu com sucesso, versão 0.1.0 / versionCode 2, e o AAB está em `artifacts/releases/arca-0.1.0-versionCode-2.aab`; o proprietário já publicou essa versão em teste interno. A versão local atual é 0.2.0. Antes de produção, permanecem a validação do app instalado, revisão da ficha/declaracões, teste real de exclusão, republicação do texto atualizado da política e correções dos alertas restantes das dependências. O upload pode ser feito manualmente na Play Console ou com `npx eas-cli@latest submit --platform android --profile internal` depois de configurar as credenciais de envio. A exportação local Metro/Hermes não substitui um AAB assinado.

## Verificações

As verificações mais recentes estão em [artifacts/RANKING-AVATARES-AUDIO.md](artifacts/RANKING-AVATARES-AUDIO.md). As verificações anteriores da base, loop, Supabase, som/jornada e formatos continuam nos demais relatórios da pasta artifacts.

```sh
npm run typecheck
npm run lint
npm test
npx expo install --check
npx expo export --platform android --output-dir dist/android
```

Os testes cobrem também PostgreSQL real via PGlite (apenas desenvolvimento), migrations/seed, RLS, pontuação dos oito formatos, XP idempotente, importação, streak, tokens por conta, fila offline e caches isolados. Não substituem Supabase Auth/REST/email remoto ou dispositivo Android, especialmente sons/haptics e o botão voltar físico.

A auditoria de 14/10/2026 apontou 29 alertas (18 altos e 11 moderados) em dependências transitivas do conjunto Expo/React Native, incluindo ferramentas de build. As correções automáticas propostas incluem rebaixar Expo para SDK 44 ou misturar versões incompatíveis do Router e React Native. Não aplique `npm audit fix --force`; acompanhe os patches oficiais compatíveis antes de uma publicação. Esses alertas não são erros de typecheck/lint e continuam abertos. Patches oficiais do SDK 57 foram aplicados; veja o relatório técnico para alcance e mitigação.

Roteiro manual: avançar as quatro telas, pular a apresentação, entrar/cadastrar, validar campos vazios e senhas diferentes, mostrar/ocultar senha, solicitar recuperação, confirmar e-mail, abrir as quatro abas, sair, recarregar e verificar onboarding/sessão. Sem Supabase, use o modo de visita para validar as abas.

## Estrutura principal

```text
src/app/                   Rotas e layouts Expo Router
src/app/onboarding/        Apresentação
src/app/(auth)/            Login, cadastro e confirmação
src/app/auth/              Callback e nova senha
src/app/(tabs)/            Início, Aprender, Ranking e Perfil
src/app/lesson/            Jogador de lição e resultado
src/data/                  Unidade e perguntas locais
src/components/learning/   Trilha, alternativas, jogador e progresso
src/components/learning/questions/ Sete formatos de exercício e content_card
src/components/common/     Design system
src/components/auth/       Formulários de autenticação
src/components/mascot/     Registro e renderização do mascote
src/components/navigation/ Cabeçalhos de abas
src/constants/             Tokens visuais
src/providers/             Sessão, onboarding e progresso local/remoto
src/hooks/                 useAuth e useOnboarding
src/lib/                   Engine, progresso, Supabase e sessão
src/services/              Auth, conteúdo e operações de aprendizado
src/types/                 Profile e contratos de aprendizado
assets/mascot/             Mascote e detalhes da geração
assets/sounds/             Efeitos locais de acerto/erro e documentação
scripts/                   Geração dos efeitos e seed de aprendizado
supabase/migrations/       Identidade, conteúdo, progresso, RLS e RPCs
supabase/seed.sql          Conteúdo atual com IDs estáveis
tests/                     Auth, engine, áudio, sincronização e PostgreSQL
```

Reanimated e Expo Haptics são utilizados no feedback das lições; indisponibilidade do haptic não impede o fluxo. A prévia web usa dois players HTML reutilizados com rejeições de reprodução tratadas; o Android continua usando Expo Audio.

Documentação consultada: [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/), [rotas protegidas](https://docs.expo.dev/router/advanced/authentication/), [Supabase Auth em React Native](https://supabase.com/docs/guides/auth/quickstarts/react-native) e [links no Supabase](https://supabase.com/docs/guides/auth/native-mobile-deep-linking).

## Testes automatizados

Consulte [docs/TESTING.md](docs/TESTING.md) para a separacao entre testes unitarios,
integracao PostgreSQL e jornadas completas com Playwright. `npm run check` executa
as verificacoes e as tres camadas de testes. Na primeira execucao, instale o
navegador com `npm run test:e2e:install`.
