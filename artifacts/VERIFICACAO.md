# Verificacao da entrega: fases 1 e 2

Data: 5 de outubro de 2026.

## Estado inicial

O diretorio do projeto ChatGPT continha apenas `AGENTS.md` e `sources/`. Nao havia aplicativo ou repositorio Git nesse diretorio. Foi criado o projeto isolado `arca-mobile/` com o template oficial do Expo. Os arquivos sincronizados em `sources/` foram preservados.

## Verificacoes executadas

| Verificacao | Resultado |
| --- | --- |
| `npm run typecheck` | Aprovado, sem erros, apos as correcoes finais |
| `npm run lint` | Aprovado, sem erros ou warnings, apos as correcoes finais |
| `npm test` | 13 testes aprovados |
| `npx expo-doctor` | 21 de 21 verificacoes aprovadas |
| `expo export --platform android` | Bundle Hermes e assets gerados em `dist/android` |
| Expo web | Executado em `http://localhost:8081` |
| Onboarding | Quatro passos, indicadores, cadastro e preferencia mantida apos recarregar |
| Formulario de cadastro | Campos obrigatorios e senhas diferentes validados |
| Login e recuperacao | Navegacao e campos obrigatorios validados |
| Modo de visita | Inicio, Aprender, Ranking e Perfil navegaveis; saida para login |
| Reinicio do modo de visita | Sessao de visitante descartada; retorna ao login |
| Layout | Inspecionado em 320 x 640, 390 x 844 e 1280 x 900; sem overflow horizontal |
| Mascote | Bitmap carregado e inspecionado nas telas |
| Runtime web | Nenhum erro observado; houve um aviso de desconexao durante a troca deliberada do servidor |

Capturas: `onboarding-mobile.jpg` e `home-mobile.jpg`.

## Limites da verificacao

- Nao foram fornecidas credenciais Supabase. Nao foram criados usuarios remotos nem aplicada a migration ao banco remoto; envio de e-mails, login e persistencia de uma sessao real ainda precisam de validacao com o projeto configurado.
- Os testes de persistencia validam o adaptador e seu comportamento de falha, sem substituir a verificacao do SecureStore em dispositivo.
- A exportacao Android comprova a compilacao do JavaScript e dos assets, mas nao e um APK/AAB nem um teste em emulador ou telefone. Nenhum build EAS foi enviado.
- `npm audit` apontou 30 alertas (19 altos e 11 moderados) na arvore de dependencias do conjunto Expo/React Native. As propostas automaticas incluem versoes incompativeis ou rebaixamento de SDK. Os alertas permanecem documentados; nao foi aplicado `audit fix --force`.

## Servidor local

Expo foi deixado em segundo plano com Expo Go selecionado e porta 8081. Os logs locais ficam em `.logs/` (ignorados pelo Git). Processo iniciado nesta entrega: 15228. No PowerShell, `Stop-Process -Id 15228` encerra esse processo, se ainda for a mesma instancia. Para iniciar novamente, use `npm start` ou `npm run web`.

## Escopo preservado

Nenhuma engine de licao, curso, unidade, XP, streak, conquista ou ranking funcional foi implementada. As abas dessas areas exibem estados de indisponibilidade. O Perfil contem apenas as operacoes de conta necessarias a autenticacao.
