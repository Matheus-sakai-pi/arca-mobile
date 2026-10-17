# Arca: teste interno na Google Play

Preparacao iniciada em 14/10/2026. O usuario confirmou uma conta Play Console
pronta, escolheu teste interno e confirmou que sera o primeiro envio.
Login Expo autorizado pelo usuario na conta matsak. Projeto vinculado:
79327637-1bc6-4096-869d-ee2f59df6edb. Chave de upload inicial gerada e armazenada
no EAS. Primeiro build AAB concluido com sucesso, versao 0.1.0, versionCode 2:
[build EAS](https://expo.dev/accounts/matsak/projects/arca-mobile/builds/1a1c0ea1-667c-4d27-8090-6c79bc05294b).
Arquivo baixado em artifacts/releases/arca-0.1.0-versionCode-2.aab.
Estrutura AAB, bibliotecas ARM64 e presenca do certificado de assinatura
conferidas no ZIP. A validacao final de instalacao deve ser feita pela loja.
O proprietario publicou esse AAB em teste interno; a versao 0.1.0 foi indicada
como disponivel aos testadores no Play Console. Nao houve publicacao em producao.
A versao local atual e 0.2.0; registro do novo build ao final deste documento.

No primeiro build, TypeScript, lint, 156 testes, Expo Doctor (21/21) e exportacao Android passaram.
A verificacao atual inclui os testes adicionais de estudo, backup e privacidade;
consulte docs/REFINAMENTOS-AUTONOMOS.md.
O pacote EAS foi inspecionado: source/assets presentes; nenhum .env, arquivo de
chave privada, teste, captura, migration ou script foi copiado. O inspetor EAS
mantem algumas pastas vazias, que nao contem os materiais excluidos.
URL e chave anon publica do Supabase configuradas no ambiente EAS production;
callback do app instalado fixado em arca://auth/callback. Ainda e necessario
conferir esse redirect no painel Supabase e validar os emails no app instalado.

## Configuracao preparada

- `eas.json`: production gera AAB e usa o ambiente EAS production.
- `autoIncrement` e `appVersionSource: remote` gerenciam o versionCode no EAS.
- `submit.internal`: faixa internal, releaseStatus draft. Nao publica em producao.
- `.easignore`: exclui ambientes locais, credenciais privadas, testes, capturas,
  logs, referencias e migrations. Codigo e assets reais continuam no build.
- Identidade atual: `com.arca.mobile`, nome Arca, versao local 0.2.0. Package e chave de upload mantidos.
- EAS Update ainda nao esta configurado. Atualizacoes exigem um novo build por enquanto.

## Antes de iniciar o build

1. Autenticar no Expo pelo navegador. Nunca enviar senha, token Expo ou JSON
   de conta de servico no chat ou inclui-los no app.
2. Confirmar a conta Expo proprietaria, vincular/criar o projeto EAS e registrar
   o projectId real em app.json. Nao inventar IDs.
3. Confirmar se houve algum AAB anterior no Play Console. Se houve, preservar
   o package e a chave de upload existentes. Se for primeiro envio, confirmar
   disponibilidade do package e usar credenciais remotas gerenciadas pelo EAS.
4. No ambiente EAS production, configurar os valores publicos do Supabase:
   EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY. Usar somente chave
   anon/publishable, nunca service_role, sb_secret ou senha de banco.
5. Configurar EXPO_PUBLIC_AUTH_REDIRECT_URL como arca://auth/callback no ambiente
   production. Nao levar localhost ou exp:// para o build da loja.
   Cadastrar arca://auth/callback nos redirects autorizados no painel Supabase e
   testar confirmacao de cadastro e recuperacao de senha no build instalado.
6. Conferir migrations/conteudo e envio de email do Supabase usado no build.
   Os testes locais de banco nao confirmam a configuracao do projeto remoto.

Comandos abaixo devem ser executados na pasta arca-mobile:

```powershell
npx eas-cli@latest whoami
npx eas-cli@latest login
npx eas-cli@latest init
npx expo-doctor@latest
npm run typecheck
npm run lint
node --experimental-strip-types --test --test-concurrency=1 tests/*.test.ts
npx eas-cli@latest build --platform android --profile production
```

Nao usar --auto-submit. O build envia os arquivos do app ao Expo e pode consumir
a cota da conta. Nao contratar plano ou aceitar cobranca automaticamente.

## Enviar o AAB para teste interno

1. Aguardar o build EAS terminar com sucesso e baixar o arquivo .aab real.
   Uma exportacao Metro/Hermes em dist/ nao e um AAB assinado.
2. Abrir o aplicativo correto no Play Console, configurar Play App Signing
   e criar uma versao em Testar e lancar > Teste > Teste interno.
3. Fazer upload do AAB, conferir versionCode/package e preencher notas reais.
4. Selecionar os testadores, revisar os avisos e liberar somente o teste interno.
5. Distribuir o link de participacao aos testadores e instalar pela Play Store.
   O teste usa app proprio, sem Expo Go e sem depender do computador/Metro.

Alternativa futura, depois de configurar uma Google Service Account no EAS:

```powershell
npx eas-cli@latest submit --platform android --profile internal --id BUILD_ID_REAL
```

Esse perfil so envia rascunho interno. A liberacao aos testadores ainda e feita
no Play Console. Guardar a chave privada fora do repositorio.

## Checklist do APK instalado pela loja

- Abrir com Metro desligado; conferir Home, trilha, Perfil e Ranking.
- Completar licao; conferir XP, desbloqueio e resultado; fechar e reabrir.
- Testar uma revisao sem duplicar XP, modo offline e sincronizacao ao reconectar.
- Testar errado/errado/correto/errado/correto/errado com audio/haptic.
- Conferir botoes ativos/desativados e podium em Android com tela pequena.
- Testar login, logout, cadastro, confirmacao por email e recuperacao de senha.
- Testar troca de conta e garantir que progresso de uma nao aparece na outra.
- Conferir ranking real, avatar salvo, nome longo e fontes ampliadas.
- Ao enviar uma segunda versao interna, atualizar sem desinstalar e conferir
  preservacao de conta, progresso e preferencias.

## Pendencias antes de teste fechado/lancamento publico

- Republicar o texto atualizado da politica em legal-site/dist no site existente.
  A politica ja foi publicada com responsavel e contato reais.
- Validar a exclusao de uma conta descartavel no app instalado e no backend real.
  O fluxo no app, a funcao e a via web foram implementados; publicacao remota foi
  relatada pelo proprietario.
- Revisar Seguranca dos dados ja preenchida conforme coleta real: conta, email, perfil,
  desempenho/progresso e servicos utilizados. Revisar o que e visivel no ranking.
- Conferir declaracoes ja preenchidas de acesso, publicidade, publico-alvo e classificacao.
  Nao pressupor que o app nao e destinado a criancas so pelo tema ou visual.
- Preparar textos, icone, imagem de destaque e capturas reais, sem dados ficticios
  apresentados como recursos/participantes reais do app publicado.
- Revisar os alertas de seguranca restantes das dependencias. O npm audit
  identificou alertas transitivos e sugeriu trocas incompativeis de SDK em parte
  dos casos; nao executar audit fix --force para silencia-los. Avaliar alcance
  real e correcoes suportadas antes de producao.
- Confirmar direitos/licencas de imagens, fontes e audio.
- Se a conta pessoal estiver sujeita aos requisitos atuais de acesso a producao,
  fazer teste fechado com pelo menos 12 testadores inscritos por 14 dias
  consecutivos. Teste interno nao substitui esse requisito.

## Referencias oficiais

- [Build e assinatura Expo](https://docs.expo.dev/build/setup/)
- [Upload e teste interno](https://docs.expo.dev/submit/android/)
- [Ambientes EAS](https://docs.expo.dev/eas/environment-variables/)
- [Arquivos excluidos do build](https://docs.expo.dev/build-reference/easignore/)
- [Requisitos de testes pessoais](https://support.google.com/googleplay/android-developer/answer/14151465?hl=pt-BR)
- [Exclusao de contas](https://support.google.com/googleplay/android-developer/answer/13327111?hl=pt-BR)

## Novo build 0.2.0

Solicitado em 14/10/2026: versao 0.2.0, versionCode 4, pacote com.arca.mobile.
Assinatura remota existente preservada; nenhum plano contratado.
[Acompanhar no Expo](https://expo.dev/accounts/matsak/projects/arca-mobile/builds/2b2043c9-f20f-424d-b3d3-79e4ee58ca44).

Build concluido com sucesso em 14/10/2026, 20:38 UTC.
Arquivo baixado: artifacts/releases/arca-0.2.0-versionCode-4.aab, 116.472.728 bytes.
Nao enviado a Play Store.
O build anterior desta rodada, versionCode 3, foi cancelado enquanto estava
na fila para incluir o ajuste final de legibilidade. Nao usar esse build.

Validacoes do codigo atual: 189 testes, TypeScript, lint, Expo Doctor 21/21,
exportacao Android/Hermes e testes de navegador em 320/390/430/1280 pixels.
Ainda faltam instalacao real e verificacoes remotas descritas no checklist.
Sem --auto-submit e sem EAS Update.

Conferencia do arquivo: bundletool validate passou; manifesto com com.arca.mobile,
0.2.0 e versionCode 4; certificado igual ao AAB anterior; jarsigner retornou
"jar verified". Rotas novas e chaves de retomada/configuracoes presentes no bundle.
As permissoes sao identicas as da 0.1.0: sem AD_ID, localizacao ou microfone.

Java 27 emitiu avisos de certificado autoassinado, ausencia de timestamp e ordem
de leitura JarInputStream. A verificacao de assinatura via JarFile passou.
Esses avisos nao foram apagados nem o AAB reempacotado/reassinado; a validacao
pela Play Console e instalacao no Android continuam pendentes.

SHA-256: 2DF200ED42EA286BDAEC387895BA905DE1465730E71357B6A81AC3A4A4F7C8C3.

## Build 0.3.0

Solicitado em 15/10/2026, versao 0.3.0 / versionCode 5. Inclui a rodada visual,
artes de unidades/conquistas, tres modos de ranking, amigos e nome publico unico.
Pacote com.arca.mobile e a chave remota existente mantidos. Sem auto-submit,
sem EAS Update e sem publicacao na Google Play.
[Build EAS](https://expo.dev/accounts/matsak/projects/arca-mobile/builds/810fe5bb-d19a-45c7-9b70-0e6cfb26bf92).

Antes do envio passaram 216 testes, TypeScript, lint completo e Expo Doctor 21/21.
Build concluido em 15/10/2026, 15:06:55 UTC. Arquivo baixado e validado em
artifacts/releases/arca-0.3.0-versionCode-5.aab, 150.019.865 bytes.
[Download EAS](https://expo.dev/artifacts/eas/uDDx4g632aF22Lt1qkxD4ANEdq6kZeayPxXS6t52ab0.aab).

bundletool validate passou. Manifesto confirmado com com.arca.mobile, versao 0.3.0,
versionCode 5 e permissoes identicas ao AAB 0.2.0: sem AD_ID, localizacao ou
microfone. Bundle Hermes contem as RPCs de amigos, ranking semanal e nome unico;
biblioteca ARM64 presente. jarsigner retornou "jar verified". Certificado SHA-256
igual ao arquivo anterior:
9DD04F7DCE06668624C1CEC8961BDD27A2EEB1E0A56E6C053CAE412541D6C95A.

Java 27 repetiu os avisos de certificado autoassinado, ausencia de timestamp,
atributos POSIX e ordem de leitura JarInputStream observados no AAB anterior.
A verificacao JarFile passou; o arquivo nao foi reempacotado nem reassinado.
Validacao na Play Console e instalacao/atualizacao no Android continuam pendentes.

SHA-256 do arquivo:
1B4505A600B2C55A2B1ECCB2E2FFF12E312C8EFC49717BB94647FD0291F68458.

Recursos de amigos/XP semanal precisam de 202610150001_friends_weekly.sql;
cadastro/nome unico precisa de 202610150002_public_username.sql. Em 15/10/2026,
consultas somente de leitura ao projeto configurado retornaram HTTP 200 para
learning_leaderboard_scope('weekly') e learning_username_available(...).
Nenhuma migration ou escrita foi executada por esta compilacao. Fluxos com duas
contas, politica publica e testes no Android continuam precisando de conferencia.

## Build 0.3.0 / versionCode 6 - 17/10/2026

Novo AAB solicitado pelo proprietario, com o codigo atual: onboarding, ajustes
visuais sem os banners panoramicos removidos, desafios, lembretes/notificacoes e
bateria por exercicio. Sem alteracao de pacote ou chave, auto-submit, EAS Update,
publicacao na Play Store ou mudanca no Supabase.

[Build EAS](https://expo.dev/accounts/matsak/projects/arca-mobile/builds/83bf7638-8ec1-42e2-a91d-75d087b679f8).
[Download AAB](https://expo.dev/artifacts/eas/Wo4SzIVs_sxVKUTPMEXpxtFqg-CKKeuynJfn-7LkSDY.aab).
Concluido em 17/10/2026, 12:33:59 UTC. Arquivo local:
artifacts/releases/arca-0.3.0-versionCode-6.aab (156.213.193 bytes).

bundletool validate passou; manifesto confirma com.arca.mobile, 0.3.0 e codigo 6.
jarsigner retornou "jar verified". Certificado SHA-256 identico ao AAB anterior:
9DD04F7DCE06668624C1CEC8961BDD27A2EEB1E0A56E6C053CAE412541D6C95A.
O bundle Hermes inclui learning_battery e as regras de bonus; a bateria rosa e
as bibliotecas ARM64 estao presentes. Nao ha endereco da API local de previa,
chave ficticia de previa ou projeto E2E no codigo compilado.

Permissoes novas incluem notificacoes, recepcao FCM, reinicializacao, badges de
launchers e install referrer. Nao foram encontradas AD_ID, localizacao ou
RECORD_AUDIO. As permissoes nao sao identicas as do codigo 5.

Lint e TypeScript passaram nesta rodada. A rodada imediatamente anterior passou
279 testes unitarios/integracao, 81 cenarios Playwright e os 18 de bateria outra
vez. No EAS, Expo Doctor passou 20/21 verificacoes: recomenda patches Expo
57.0.30 e Router 57.0.28; foram mantidos 57.0.29/57.0.27, ja testados. A
compilacao concluiu normalmente, sem alterar dependencias durante o build.

Java 27 repetiu avisos de certificado autoassinado, ausencia de timestamp,
atributos POSIX e diferenca de leitura JarFile/JarInputStream vistos nos AABs
anteriores. O arquivo original assinado pelo EAS foi preservado, sem reempacotar
ou reassinar. Logs estao em artifacts/releases/arca-versionCode-6-*.txt.

SHA-256 do arquivo:
72D2410016217BA4989BB9A481EAB677901B95C7BB2D7A8573A406FB3F465FEF.

Antes de distribuir: aplicar as migrations exigidas pelos recursos novos;
particularmente 202610170001_exercise_energy.sql e 202610170002_battery_push.sql,
ou o bundle artifacts/battery/ativar-bateria.sql uma unica vez. Consulte
ENERGY-V2.md: coordenar com o cliente compativel, pois clientes antigos sao
bloqueados pelo protocolo novo de bateria. Esta compilacao nao comprova essas
ativacoes, entrega push real, atualizacao de instalacao Android ou publicacao
da politica atualizada. Validacao na Play Console e teste fisico continuam
pendentes.
