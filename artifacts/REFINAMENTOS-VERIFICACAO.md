# Verificacao dos refinamentos: audio e jornada

Data local: 2026-10-05. Expo SDK 57, React Native 0.86.3.

## Escopo preservado

Nao foram modificados conteudo de `src/data/lessons.ts`, engine de respostas, formula de XP, desbloqueio, `LearningProvider`, schema/chave `arca.learning.v1`, imagens, tokens visuais, Home ou telas de autenticacao. Nenhuma conexao nova ao Supabase. A navegacao da licao existente foi reutilizada.

## Arquivos deste refinamento

Alterados:

- `package.json` e `package-lock.json`: dependencia Expo Audio compativel instalada pelo Expo.
- `app.json`: plugin de audio, com microfone, gravacao e background desabilitados em builds proprios.
- `src/components/learning/LessonPlayer.tsx`: chamada nao bloqueante do som correto/incorreto junto do feedback existente.
- `src/app/(tabs)/learn.tsx`: troca somente da apresentacao da trilha por JourneyTrail.
- `README.md`: funcionamento, configuracao e roteiro de teste no Android.

Criados:

- `assets/sounds/correct.wav` e `wrong.wav`: efeitos originais reais, incluidos no app.
- `assets/sounds/README.md`: especificacao dos assets e instrucoes de substituicao.
- `scripts/generate-feedback-sounds.mjs`: gerador deterministico dos dois WAVs.
- `src/constants/sounds.ts`: fontes locais, volume, habilitacao padrao e diagnostico opcional.
- `src/hooks/useLessonSounds.ts`: dois players pre-carregados, modo de audio e ciclo de vida.
- `src/lib/feedbackPlayback.ts`: repeticao, cancelamento, on/off e isolamento de falhas de audio.
- `src/components/learning/JourneyNode.tsx` e `JourneyTrail.tsx`: estados dos nos, feedback de bloqueio e jornada responsiva.
- `src/lib/journeyLayout.ts`: geometria compartilhada entre nos e conectores.
- `tests/refinements.test.ts`: 10 novos testes, alem dos 25 anteriores.
- Este documento e capturas `journey-390.jpg`, `journey-320-top.jpg`, `journey-320-bottom.jpg`, `journey-wide-path.jpg`.

## Verificacoes executadas

- `npm run typecheck`: aprovado, codigo de saida 0.
- `npm run lint`: aprovado, codigo de saida 0, `--max-warnings=0`.
- `npm test`: 35 testes aprovados, zero falhas/skips.
- `npx expo install --check`: dependencias atualizadas; o proprio Expo avisa que a validacao em modo offline e limitada.
- Conferencia direta de `expo/bundledNativeModules.json`: Expo Audio esperado `~57.0.5`, instalado `57.0.5`, intervalo compativel.
- `npx expo export --platform android --output-dir dist/refinements-android`: aprovado, 3691 modulos, bundle Hermes e 34 assets; os WAVs de 42 KB e 32 KB constam da exportacao. A exportacao final foi refeita com diagnostico desativado.
- Nao foi executado prebuild, nao foram criadas pastas nativas e nao houve build remoto ou publicacao.

## Testes pela interface

Aplicativo rodando em `http://localhost:8083`. Testes de progresso novo usaram a origem local separada `http://127.0.0.1:8083`, sem apagar o progresso existente.

1. Onboarding, Conhecer sem entrar e Aprender: inicio com 0 XP, primeira licao disponivel e demais bloqueadas.
2. Toque na segunda bloqueada: permaneceu em `/learn`, animacao suave e requisito exibido. Repetido na terceira e quinta; nao abriu licao.
3. Toque no primeiro no disponivel: abriu `/lesson/o-que-e-a-biblia`. Verificar desabilitado antes da selecao.
4. Resposta incorreta na primeira pergunta: Quase!, destaque da escolha errada, resposta correta, explicacao e player wrong.
5. Respostas corretas seguintes: Correto!, explicacao e player correct reutilizado. A barra avancou ate 100%.
6. Resultado: 4/5, 80%, +18 XP. Continuar voltou a Aprender: primeiro no com check, segundo no atual com aro dourado e CTA, demais bloqueados.
7. CTA do segundo no abriu a segunda licao. Saida pediu confirmacao e voltou sem conceder XP por uma tentativa incompleta.
8. Recarga completa, retorno pelo modo de visita e abertura de Aprender: mesmos 18 XP, 1/5, primeiro concluido, segundo atual e demais bloqueados.
9. Origem anterior `localhost`: progresso de teste previo preservado, 118 XP e 5/5 concluidas.
10. Capturas em 390x844, 320x640 e 1280x900. Em 320 px, centros dos cinco nos foram 160, 96, 224, 160, 96: zigue-zague real, toque de 104 pontos dentro dos limites. Scroll ate o fim permitiu ler o requisito completo do ultimo no acima das abas, sem corte permanente.
11. Um aviso web do SVG decorativo foi encontrado e corrigido: ocultacao de acessibilidade e pointerEvents ficaram no wrapper View. A recarga final nao registrou erros/warnings da pagina.

## Evidencia de audio

O diagnostico foi habilitado temporariamente durante o teste e desligado ao terminar. Os eventos reais de `playbackStatusUpdate` do Expo Audio registraram:

```text
correct: loaded=true, duration=0.48
wrong:   loaded=true, duration=0.36
wrong:   playing=true -> finished=true
correct: playing=true -> finished=true
correct: playing=true -> finished=true (repeticao)
```

Os testes automatizados conferem WAV valido PCM mono 16 bits/44100 Hz, duracao curta, conteudo distinto nao vazio, sem clipping e sem salto nas amostras inicial/final. Tambem cobrem reutilizacao e seek(0), efeitos desligados, perda de foco, cancelamento durante seek pendente, concorrencia, falhas de modo/decodificacao e reativacao.

## Limites e teste fisico pendente

- Nao houve acesso a um Android fisico nesta execucao. O usuario ja havia validado a base no Expo Go; os novos sons ainda precisam ser ouvidos no alto-falante/fone desse aparelho, junto do haptic. Exportar um bundle Android e testar o player web nao substitui isso.
- Expo Audio esta incluido no Expo Go do SDK 57. Os efeitos usam arquivos locais e APIs cross-platform, sem dependencia exclusiva da web. A politica de silencioso foi corrigida no follow-up abaixo; confira o volume de midia.
- Nenhum dos dois efeitos e mock/placeholder e nenhum asset falta. Uma preferencia de som na tela e sua persistencia ficam para uma etapa futura; a configuracao facil e o hook com booleano ja existem.
- Ranking continua indisponivel, autenticacao depende da configuracao anterior do Supabase e o mascote continua usando a pose PNG existente. Nada disso foi ampliado nesta etapa.
- A auditoria do npm continua com os 30 alertas transitivos documentados anteriormente. Nao foi usado `audit fix --force` nem mudado o SDK para tentar elimina-los.

Roteiro fisico detalhado em README.md, secao Teste manual dos refinamentos no Android.

Documentacao oficial consultada: [Expo Audio SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/audio/) e [Reanimated useSharedValue](https://docs.swmansion.com/react-native-reanimated/docs/core/useSharedValue/).

## Follow-up: som ausente no Android / Expo Go

O usuario relatou ausencia de som no Android. Foi identificado `playsInSilentMode: false`: no SDK 57, essa flag faz o metodo nativo `play()` retornar sem tocar quando o ringer do Android esta em silencioso/vibrar. O comportamento foi confirmado tanto na documentacao versionada quanto em `node_modules/expo-audio/android/src/main/java/expo/modules/audio/AudioModule.kt`, linhas 467-479. Nao foi possivel consultar o modo de som do aparelho do usuario; esse e um bloqueio real identificado no codigo, nao uma confirmacao de que seu aparelho estava em vibrar.

A configuracao agora esta em `feedbackAudioMode`, no controlador de feedback: `playsInSilentMode: true`, saida de midia (sem earpiece forcado), gravacao/microfone e background desativados. Volume de midia zero e a opcao de efeitos desligados continuam respeitados. O hook usa diretamente essa politica. Players, assets, XP e progresso nao foram alterados.

Foi acrescentado um teste de regressao da politica Android. A reproducao pelo alto-falante do Android fisico ainda depende de recarregar o projeto no Expo Go e testar no aparelho; nao foi afirmada como verificada remotamente.

Verificacoes apos a correcao: typecheck e lint aprovados (saida 0), 36 testes aprovados, exportacao Android aprovada com os dois WAVs incluidos. Um aviso de cache do Metro provocou uma varredura completa, mas a exportacao terminou sem erro. Nenhum dado de progresso foi limpo e nenhuma dependencia foi trocada.

## Follow-up: sons apenas nas primeiras respostas

O usuario confirmou que o Android reproduzia sons somente nas primeiras duas perguntas. Foi encontrada uma diferenca concreta entre duas APIs do Expo Audio 57:

- `AudioModule.kt`, getter `isLoaded`: retorna true somente em `Player.STATE_READY`, logo false depois do fim do som.
- `AudioPlayer.kt`, `currentStatus()`: mantem `isLoaded: true` em `Player.STATE_ENDED`, pois o arquivo continua pronto para reiniciar.

O controlador estava verificando o getter antes de `seekTo(0)`, fazendo cada efeito tocar uma vez e depois ser ignorado. Agora consulta `currentStatus.isLoaded`: players finalizados podem reiniciar, enquanto arquivos nao preparados continuam protegidos. Nao houve recarga de assets por resposta, mudanca de dependencia ou alteracao no hook, XP, progresso e navegacao.

Um novo teste simula exatamente a diferenca do Android: ao terminar, o getter direto torna-se false e o status completo permanece carregado. Foram verificadas sequencias de cinco respostas corretas, cinco erradas e cinco alternadas, com contagem exata de play e seek no mesmo player. Os 37 testes e o typecheck passaram. Isso e uma simulacao do contrato nativo, nao um teste de audio ouvido no Android fisico; o usuario deve recarregar o Expo Go e testar as cinco perguntas.

Verificacao final deste follow-up: lint aprovado sem warnings e exportacao Android aprovada com 3691 modulos e os dois WAVs incluidos. Nenhum arquivo de audio foi substituido e nenhum dado local foi apagado.
