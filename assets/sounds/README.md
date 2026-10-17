# Efeitos sonoros locais

Os arquivos `correct.wav` e `wrong.wav` ja estao incluidos. Sao sinais originais sintetizados para esta entrega, nao placeholders ou downloads de terceiros.

- `correct.wav`: 0,48 segundo, tres notas ascendentes suaves (E5, G#5, B5).
- `wrong.wav`: 0,36 segundo, duas notas descendentes suaves (G4, E4), com menor amplitude.
- PCM WAV, mono, 16 bits, 44,1 kHz. Sem voz, silencio longo, links externos ou permissao de microfone.

Para regenerar os assets, execute `node scripts/generate-feedback-sounds.mjs` na raiz do app. Para trocar por audio de sua escolha, substitua estes WAVs mantendo os nomes. Se preferir MP3, adicione `assets/sounds/correct.mp3` e `assets/sounds/wrong.mp3` e altere os dois `require()` em `src/constants/sounds.ts` para a nova extensao. Nunca use arquivos vazios com extensao de audio: o player precisa de um arquivo valido.

`soundEffectsConfig.enabledByDefault` controla o padrao. A tela Configuracoes permite desativar os efeitos, com preferencia persistida por conta/visitante; false suprime novos sons e interrompe o som pendente. O volume inicial e 0,65. O audio nativo usa a saida de midia e permite reproducao no modo silencioso/vibrar do telefone; ainda respeita volume de midia zero e efeitos desligados no app. A politica esta em `feedbackAudioMode`, em `src/lib/feedbackPlayback.ts`.

Os dois players sao criados/pre-carregados ao abrir uma licao, reutilizados em todas as perguntas e liberados pelo hook oficial do Expo quando a tela desmonta. Cada repeticao volta ao inicio com `seekTo(0)`. O som oposto e pausado para evitar sobreposicao. O fluxo nunca espera o audio para exibir feedback ou navegar.

Para decidir se um audio pode reiniciar, o controlador consulta `currentStatus.isLoaded`, que inclui o estado finalizado no Android. Nao use o getter direto `player.isLoaded` como bloqueio antes do seek: no Expo Audio 57 ele retorna false em STATE_ENDED e impediria a segunda reproducao do mesmo efeito. Audios ainda nao preparados continuam sendo ignorados com seguranca.

Para diagnostico em desenvolvimento, habilite temporariamente `soundEffectsConfig.diagnostics`: logs `arca.audio.correct` e `arca.audio.wrong` mostram carregamento, reproducao e fim. Essa opcao fica desligada normalmente e nunca registra em producao.
