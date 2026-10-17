# Animacoes de progresso e conquistas

## Escopo

Camada de apresentacao com React Native Reanimated ja instalado. Nenhuma dependencia nova, regra de XP/streak/progresso, chamada de escrita no Supabase, tabela ou migration foi adicionada. A migration de formatos da entrega anterior continua sendo uma pendencia independente, caso ainda nao tenha sido aplicada.

## Componentes criados

| Componente | Aplicacao |
| --- | --- |
| AnimatedNumber | Numero reutilizavel: from, to, duration, delay, prefix, suffix, decimals, onComplete |
| AnimatedCounter | Contagem com bounce opcional e haptic positivo ao terminar um aumento |
| AnimatedProgressBar | Barras da licao, unidade e precisao; progresso suave, sem bloquear a passagem |
| EventProgressBar | Guarda o ultimo valor observado por tela/unidade |
| AnimatedRankChange | Posicao da propria conta: contagem e deslocamento sutil para cima/baixo |
| AnimatedCompletionCoin | Prata para ouro por crossfade, escala, pequeno giro e brilho |
| RewardPulse | Pulse curto de fogo/medalha, com brilho opcional |
| PodiumEntrance | Entrada do podio em 2o, 3o, 1o; 420 ms por elemento, ultimo termina em 640 ms |
| AchievementCelebration | Uma conquista por vez, entrada com escala, medalha, bounce/brilho e haptic |
| ScrollVisibility | Mede o no no viewport e compartilha um unico callback de scroll por Screen |

ResultCounters compoe os indicadores da conclusao: corretas comecam primeiro, precisao 150 ms depois, XP 300 ms depois. Cada contagem dura 850 ms. A barra de precisao usa o mesmo atraso/duracao. XP positivo termina com bounce e haptic leve. Revisao de +0 XP nao inventa uma recompensa.

## Eventos e ausencia de repeticao

RewardMotionProvider tem escopo por conta/visitante e dura a sessao. motionEvents.ts mantem memoria somente de apresentacao:

- Na primeira leitura, XP e streak sao baselines, nao ganhos novos.
- Cada consumidor tem uma chave estavel, como home:xp, profile:lessons ou rank:UUID.
- Um valor diferente anima a partir do ultimo valor observado, inclusive depois de uma tela desmontar.
- Mesmo valor retorna evento zero. Re-render nao reinicia efeitos ou chama haptic novamente.
- Perfil anima sua primeira entrada relevante a partir de zero; entradas posteriores partem do valor guardado.
- Resultados sao identificados pelo attemptId. Reabrir o mesmo resultado na sessao nao repete a contagem.
- Posicao menor significa subida no ranking; maior significa queda. A primeira resposta do servidor nao usa #0.
- As barras de unidade tem baseline por unidade; navegar para outra unidade nao anima a partir da anterior.

Anima somente a moeda correspondente a uma nova conclusao identificada no progresso e no ultimo resultado. Revisar uma ja concluida nao cria evento. Eventos existentes no primeiro carregamento nao fazem todas as moedas comemorarem. O evento so e consumido quando a moeda esta visivel, a trilha esta focada e a fila de conquistas foi confirmada; assim um no fora da tela nao perde sua animacao. Depois a imagem dourada permanece normalmente.

A tela da licao nao e mais remontada a cada pergunta, permitindo que a barra interpole o progresso. O scroll continua voltando ao topo por resetScrollKey, sem remontar os indicadores nem atrasar a navegacao.

## Conquistas

Nove definicoes em src/lib/achievements.ts:

1. Primeiro Passo: uma licao concluida.
2. Sem Errar: uma conclusao/revisao observada com 100% de precisao.
3. 3 Dias de Jornada: maior streak de pelo menos 3.
4. 7 Dias de Jornada: maior streak de pelo menos 7.
5. Estudioso: 10 licoes diferentes.
6. Conhecendo a Biblia: Unidade 1 completa.
7. Historias Fundamentais: Unidade 2 completa.
8. 500 XP: total de pelo menos 500.
9. 1000 XP: total de pelo menos 1000.

Nao concedem XP extra nem alteram ranking/streak/desbloqueio. Estudioso e os marcos de XP ficam bloqueados ate existir progresso suficiente; o curriculo atual de oito licoes, sozinho, nao alcanca esses objetivos. Nao ha dados ficticios para desbloquea-los.

Persistencia local em AsyncStorage, separada por identidade: arca.achievements.guest.v1 ou arca.achievements.UUID.v1. Salva unlocked e pending, com versao e validacao. As operacoes sao serializadas. Uma conquista so entra na interface/fila depois que a gravacao funciona. Erros nao apagam o arquivo, nao consomem uma celebracao e podem ser tentados novamente no Perfil.

As conquistas de contas esperam um snapshot confirmado: nao sao concedidas pelo XP provisoriamente projetado de uma tentativa offline. Ao sincronizar, os criterios sao avaliados novamente. A primeira leitura reconhece conquistas antigas silenciosamente; nao abre uma sequencia de popups retroativos. Novas conquistas sao enfileiradas. A fila pendente sobrevive ao fechamento e a confirmacao de uma medalha remove apenas o primeiro item.

A celebracao aparece nas abas, nunca durante uma pergunta, contagem do resultado ou fluxo de autenticacao/importacao. Um modal com Continuar mostra um item de cada vez. O Perfil lista medalhas bloqueadas/desbloqueadas.

**Limite importante:** sem mudar backend, conquistas autenticadas ficam salvas neste aparelho por conta, nao em nuvem. Dados recebidos do servidor permitem reconstruir marcos de XP/streak/unidades em outro aparelho, mas nao ha sincronizacao do historico das medalhas. Sem Errar reconhece o ultimo resultado conhecido ou uma nova conclusao perfeita; o snapshot legado nao contem todo o historico de precisao. Nao foi criada uma consulta nova nem inventada precisao antiga.

## Acessibilidade e performance

- useReducedMotion e ReduceMotion.System fazem os valores chegarem imediatamente ao destino e retiram movimento decorativo, preservando informacao e haptic essencial.
- Numeros nativos usam propriedades animadas do TextInput nao editavel no UI thread. Na web, so o valor arredondado visivel atualiza o texto, sem alterar armazenamento.
- A largura/altura dos numeros e reservada pelo texto final/inicial, evitando que a contagem redimensione o layout ou corte digitos no Android.
- Leitores de tela recebem o valor final; nao anunciam cada frame ou o campo de texto interno.
- Nenhum timer foi criado para animacoes ou conquistas. Reanimated controla duracao/atraso e cancela animacoes ao sair ou trocar o alvo.
- Medicao de visibilidade fica ativa somente para moedas com evento. Screen tem um callback de scroll compartilhado com throttle de 100 ms, nao um listener nativo por no.

## Arquivos

Criados: src/components/animation/* listados acima; src/components/learning/ResultCounters.tsx; src/components/profile/AchievementsSection.tsx; src/providers/RewardMotionProvider.tsx; src/lib/motionEvents.ts; src/lib/achievements.ts; src/lib/rewardHaptics.ts; tests/rewards.test.ts; tests/ui/RewardsPreview.tsx e este relatorio.

Alterados: src/app/_layout.tsx; src/app/lesson/result.tsx; src/app/(tabs)/home.tsx, learn.tsx, ranking.tsx e profile.tsx; src/components/common/Screen.tsx; src/components/learning/LearningStats.tsx, ProgressBar.tsx, LessonPlayer.tsx, JourneyNode.tsx e JourneyTrail.tsx.

A fixture e isolada, nao escreve progresso nem ranking. A rota temporaria qa-rewards usada na inspecao foi removida antes da exportacao. Nenhum asset ou migration anterior foi removido.

## Validacao

- TypeScript e lint: aprovados, zero warnings.
- Testes: 134 aprovados, incluindo 11 novos para baseline, re-render, identidades, moedas, ranking, criterios, fila, persistencia e falhas de disco.
- Exportacao Android: aprovada, saida dist/rewards-android; nao equivale a teste em aparelho fisico.
- Interfaces em 320 x 568 e 390 x 844: resultado, modal de conquista, contadores, trilha e podio sem overflow horizontal.
- Fluxo real de visitante na previa: licao 2 concluida com 5/5, 100%, +25 XP; total de 18 para 43 XP, duas licoes concluidas e proxima liberada. Sem Errar foi exibida/confirmada. Progresso e medalhas preservados apos recarregar.
- Fixture: 118 para 138 XP; streak 6 para 7; ranking #12 para #9 e de volta para #12. Uma captura adicional mostra um valor intermediario real de XP. Captura do resultado mostra 2/5, 5% e +0 durante os atrasos escalonados. Re-render forcado nao reiniciou as contagens.
- Ranking/streak da fixture sao apenas dados de teste. Nenhuma posicao real foi alterada nem dia de atividade inventado. Guest continua sem historico diario, como antes.
- Android fisico, audio/haptic no aparelho e preferencia de movimento reduzido do sistema precisam de conferencia manual; nao ha aparelho acessivel aqui.

## Testar manualmente

1. Abra a versao atualizada no Expo Go. O servidor existente permanece na porta 8084; se precisar reiniciar, use npx expo start --go --clear --port 8084 na pasta arca-mobile.
2. Conclua uma licao nova. Observe a barra entre exercicios, corretas, precisao e XP escalonados. Continuar deve funcionar imediatamente, sem esperar animacoes.
3. Volte a trilha, confirme qualquer medalha da fila e role ate a moeda recem-concluida. Ela deve comemorar uma vez e permanecer dourada. As moedas antigas nao devem repetir.
4. Abra Home: XP e progresso partem do ultimo valor observado. Navegue novamente sem concluir nada: nao devem voltar a zero.
5. Abra Perfil: os cinco contadores animam na primeira entrada relevante. Abra/feche configuracoes ou edite um campo: nao devem repetir. Veja as nove conquistas e seus estados.
6. Como conta, confirme uma atividade em novo dia real e observe o streak recebido do servidor. Atualize o ranking depois de uma mudanca real: sua posicao deve subir/descer suavemente. Nao altere o relogio nem dados de usuarios para simular.
7. Veja o podio: 2o e 3o entram antes do 1o, em menos de um segundo. Atualizar nomes/avatares ou revisitar a aba na sessao nao repete a entrada.
8. Feche/reabra sem limpar armazenamento: progresso e medalhas permanecem. Uma fila ainda nao confirmada reaparece, uma medalha confirmada nao.
9. Ative Remover/reduzir animacoes nas configuracoes de acessibilidade do Android e reabra o Expo Go: valores finais imediatos, sem impedir uso.

Documentacao consultada: Expo SDK 57, Expo Haptics, Reanimated withTiming/useAnimatedProps/useReducedMotion e Worklets scheduleOnRN. Sem alteracao de versoes.
