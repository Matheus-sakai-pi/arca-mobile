# Refinamentos de legibilidade e espacamento

## Ajustes

- Inicio: logo azul sobre base branca opaca; cabecalho compacto e XP/streak mais altos.
- Aprender: removido o titulo/subtitulo redundante, contadores no topo e blurRadius 2 somente no fundo. Cards, moedas e texto continuam nitidos.
- Exercicios: eliminada a altura extra do cabecalho; distancia entre progresso/contador e card reduzida.
- Resultado: superficie branca totalmente opaca.
- Ranking: titulo/subtitulo sobre branco, rotulo XP TOTAL legivel e menor distancia ate o podio.
- Perfil: titulo sobre branco, com contraste garantido.

## Arquivos Alterados

- src/app/(tabs)/home.tsx
- src/app/(tabs)/learn.tsx
- src/app/(tabs)/ranking.tsx
- src/app/(tabs)/profile.tsx
- src/app/lesson/result.tsx
- src/components/common/Screen.tsx
- src/components/common/IllustratedBackground.tsx
- src/components/navigation/TabHeader.tsx
- src/components/learning/LessonPlayer.tsx
- src/components/leaderboard/LeaderboardPodium.tsx
- tests/redesign.test.ts
- scripts/redesign-qa.mjs

Nenhum asset, conteudo, regra de XP, desbloqueio, preferencia de som ou integracao Supabase foi alterado. O blur usa a Image nativa do React Native, sem nova dependencia nem alteracao permanente do arquivo de imagem.

## Validacao

- TypeScript e lint aprovados.
- 140 testes aprovados.
- Navegacao e capturas em 320x640, 390x844 e 430x844.
- Contraste opaco dos titulos, remocao do subtitulo Aprender e blur exclusivo do fundo verificados no navegador.
- Uma licao concluida em cada contexto de visita isolado, com resultado opaco e retorno a trilha.
- Progresso e contas existentes do usuario nao foram modificados pelos testes.
- Montagem Android/Hermes aprovada em dist/refinements-android.
- Android fisico/Expo Go nao acessivel neste ambiente.

Capturas atualizadas em artifacts/screenshots/redesign/. A previa permanece em http://localhost:8084/home.
