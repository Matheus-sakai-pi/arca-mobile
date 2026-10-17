# Fundo de Aprender e som de erro

## Arquivos alterados/criados

- `assets/illustrations/journey-desert.png`: imagem local fornecida pelo usuário, copiada sem alterações.
- `src/app/(tabs)/learn.tsx`: fundo, overlay suave, cabeçalho translúcido e ativação das legendas protegidas.
- `src/components/common/Screen.tsx`: slot opcional de fundo; telas que não o utilizam permanecem iguais.
- `src/components/learning/JourneyTrail.tsx`: opção visual de fundo nas legendas; lógica, geometria, cliques e estados preservados.
- `src/lib/feedbackPlayback.ts`: espera cancelável de prontidão, isolamento da pausa do player oposto e diagnóstico de erros.
- `src/hooks/useLessonSounds.ts`: conecta diagnóstico de falhas reais em desenvolvimento; continua com dois players pré-carregados e estáveis.
- `tests/refinements.test.ts`: cinco regressões novas para prontidão, repetição, cancelamento, timeout e pausa do player oposto.
- `README.md`: descrição das duas melhorias.
- `artifacts/FUNDO-AUDIO-VERIFICACAO.md`: este relatório.
- `artifacts/trilha-fundo.jpg` e `artifacts/trilha-audio-eventos.json`: evidências da inspeção da prévia.

## Imagem

SHA-256 da imagem original e da cópia: `EE0ECFCEB9BD867947690B4B76BE34A68B429B3F0B6C2D865DD3E32BD53B578B`.

Um Image ocupa o contêiner por absoluteFill, com resizeMode cover. Não existem dimensões fixas de dispositivo nem transformação da imagem: preserva proporção, podendo cortar bordas para cobrir diferentes telas. Fica fora da ScrollView, atrás do conteúdo, e não intercepta toques. Camada branca com 28% de opacidade, faixa de cabeçalho com 88% e legendas com 90% protegem a leitura. Os nós, seus quatro estados e os conectores continuam os mesmos e usam o cálculo responsivo existente.

## Problemas encontrados no código de áudio

1. A checagem pontual `!player.currentStatus.isLoaded` retornava sem tocar. `downloadFirst` resolve o asset de forma assíncrona; o player também pode estar bufferizando quando chega a verificação. Nesse caso, uma solicitação válida era descartada, sem aguardar prontidão.
2. A pausa do player oposto acontecia dentro do mesmo try da reprodução escolhida. Uma exceção na pausa abortava o efeito selecionado, mesmo se seu player estivesse pronto.
3. O catch geral ocultava a falha, dificultando distinguir uma resposta sem som de um player com problema.

Esses caminhos de falha foram reproduzidos com players de teste. Sem acesso ao Android físico do usuário, não foi possível confirmar se eram a única causa do problema relatado naquele aparelho.

## Correção

Players separados e WAVs existentes foram preservados. Ao verificar, a prontidão do player escolhido é aguardada por playbackStatusUpdate e consulta de segurança a cada 50 ms, somente durante a espera. Limite de dois segundos evita espera indefinida de um asset defeituoso. A interface não aguarda o áudio. Quando pronto, o player é pausado, rebobinado para zero com await seekTo e reproduzido.

Uma revisão da solicitação impede áudio atrasado após nova resposta, desativação, perda de foco ou segundo plano; timers/listeners são removidos. A pausa do player oposto é isolada. Falhas reais são avisadas em desenvolvimento sem impedir feedback visual, haptic, XP ou navegação. Logs detalhados de status foram ligados apenas durante a inspeção e voltaram a false ao terminar.

## Verificações

- TypeScript e lint sem erros/warnings.
- 63 testes aprovados; incluem cinco erros consecutivos com carregamento atrasado, readiness após buffering, repetição de players no estado Android ENDED, ausência de evento, cancelamento, timeout recuperável e pausa do player oposto com erro.
- Export Android/Hermes em `dist/trail-audio-android`, com a imagem e os dois efeitos locais. Nenhuma dependência nova ou alteração de configuração nativa.
- Prévia inspecionada em 320 x 640 e 390 x 844: imagem carregada com dimensões originais 941 x 1672, textos legíveis, caminho em zigue-zague e rolagem até os passos bloqueados. Clique em bloqueada mostrou o requisito e não abriu lição. Clique em concluída abriu revisão.
- Na prévia, cinco respostas erradas seguidas registraram cinco eventos playing=true e cinco didJustFinish=true no player wrong, sem erros de áudio. Em seguida, uma resposta certa registrou início/fim no player correct. São eventos reais do player web, não confirmação auditiva em Android.
- A sessão principal em localhost continuou com 118 XP e cinco lições concluídas. O teste da sequência usou uma sessão separada em 127.0.0.1, com 18 XP e uma concluída; revisão recebeu +0 XP. Nenhum progresso foi apagado ou resetado.
- Corrigido um aviso de pointerEvents da nova camada de fundo, usando o campo de estilo em vez da prop obsoleta.

## Teste manual no Android/Expo Go

1. Reinicie a sessão de desenvolvimento na pasta do app com `npx expo start --go --clear`. Abra o QR code no Expo Go e aumente o volume de mídia. Não apague dados do aplicativo.
2. Em Aprender, confira a paisagem, texto da unidade e os nós; role até o último passo. Gire a tela e confira que não há imagem esticada, textos cortados nem botões impedidos de receber toque.
3. Se existir uma bloqueada, toque nela: aparece a lição necessária e não há navegação. Abra uma atual/disponível ou revise uma concluída. Revisão continua recebendo +0 XP.
4. Para cinco erros seguidos na primeira lição, use: Um único poema; mares; Salmos com Carta, Gênesis com Poemas e cânticos, Romanos com Narrativas das origens; Versículo, Livro, Capítulo; Paulo. Toque em Verificar e ouça o efeito curto em cada uma, especialmente a terceira, quarta e quinta. Aguarde o término antes de continuar.
5. Reabra a primeira lição e escolha Uma coleção de livros para testar o som de acerto. Alterne acertos/erros numa tentativa seguinte para conferir ambos os players.
6. Durante feedback, minimize o app ou saia da lição: não deve haver reprodução atrasada em segundo plano. Reabra e confira XP/conclusões iguais aos anteriores.

Não havia Android físico/emulador acessível neste ambiente; audição no telefone e haptic nativo precisam desta confirmação manual. Se continuar falhando, os avisos `[arca.audio.wrong] Falha ao reproduzir efeito` do servidor em desenvolvimento ajudam a identificar carregamento/decoder, em vez de esconder o problema.
