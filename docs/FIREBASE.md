# Firebase e avisos automaticos

## Preparado

- Projeto Firebase: `arca-efe4b`.
- Aplicativo Android: `com.arca.mobile`.
- `google-services.json` validado e referenciado por `expo.android.googleServicesFile`.
- Plugin `expo-notifications` ja instalado no SDK 57.
- Padroes de arquivos de conta de servico ignorados no Git e no envio de builds.
- Credencial FCM V1 do projeto `arca-efe4b` adicionada pelo usuario no EAS, conforme captura do painel. Nao foi lida, copiada ou criada pelo agente.
- Registro de tokens Expo, atualizacao em primeiro plano/rotacao, revogacao na saida e protecao para troca/exclusao de conta.
- Preferencias separadas em Perfil > Lembrete de estudo: energia e retorno. Ambas desligadas por padrao; permissao somente por acao explicita.
- Aviso de energia quando houver recuperacao apos saldo zero, ou recarga completa de um saldo parcial. Convite de retorno apos tres dias sem abrir/sincronizar o app, no maximo semanal.
- Maximo de uma tentativa remota por conta a cada 24 horas, entre 8h e 20h no ultimo fuso do aparelho. O lembrete diario local e independente. Nao e possivel garantir o instante de entrega pelo sistema operacional.

O arquivo de configuracao do aplicativo contem identificadores publicos. Ele nao e a chave privada de uma conta de servico e nao autoriza envios pelo servidor.

## Implantar no Supabase

1. Aplique as migracoes anteriores e `supabase/migrations/202610160005_push_notifications.sql`. O envio global instala **desligado** e nenhum usuario tem consentimento presumido.
2. Publique a Edge Function `dispatch-push` (diretorio `supabase/functions/dispatch-push`). Preserve `verify_jwt=false` em `supabase/config.toml`: ela valida um segredo de servidor proprio, nao tokens de usuarios. Use CLI Supabase autenticada: `supabase functions deploy dispatch-push --project-ref <projeto>`. Nunca use a chave FCM privada no cliente ou nesta funcao: ela ja esta no EAS.
3. Configure `PUSH_DISPATCH_SECRET` nos secrets da funcao, com pelo menos 32 caracteres aleatorios. Guarde o mesmo valor no Vault, com nome `push_dispatch_secret`. Nao inclua esse valor em codigo, SQL salvo, EXPO_PUBLIC, screenshots ou chat. A funcao usa SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY fornecidos pelo ambiente da Edge Function, sem publica-los.
4. Se Enhanced Push Security estiver ativado no Expo, configure tambem `EXPO_ACCESS_TOKEN` nos secrets da funcao. Sem esse recurso habilitado, o Expo aceita envio sem esse token. Nao confundir esse token com a chave privada FCM.
5. Guarde a URL HTTPS deste projeto Supabase no Vault com nome `push_project_url`. Ative `pg_cron` e `pg_net` em Database > Extensions, conforme disponibilidade do plano. Execute `supabase/templates/push-cron.sql`. O job roda a cada cinco minutos; usa o segredo do Vault, nunca a chave service_role em SQL do cron. Isso pode consumir quotas/custos dos fornecedores; nenhum plano pago foi habilitado nesta tarefa.
6. Publique a politica de privacidade atualizada, revise a declaracao de Seguranca dos dados e gere um novo build Android. A geracao local de legal-site/dist nao publica o site legal.
7. Para testar no Android real, escolha uma conta de teste e ative o dispatcher somente para ela: `update public.push_config set enabled=true,all_accounts=false,test_user_id='<UUID da conta de teste>' where singleton;`. Depois de validar, `update public.push_config set all_accounts=true,test_user_id=null where singleton;` libera para todas as contas que consentiram. Para pausar: `update public.push_config set enabled=false where singleton;`. Excluir a conta de teste nao amplia automaticamente a liberacao. Nao ha botao para disparar campanhas a todos nem envio de teste a usuarios reais nesta tarefa.

O envio usa Expo Push Service, que encaminha ao Firebase Cloud Messaging com a credencial que voce adicionou. A arquitetura conserva o Supabase como fonte do saldo e do consentimento; nao exige Firestore, Firebase Analytics ou Cloud Functions do Firebase.

## Garantias e limites

- Tabelas de tokens e mensagens nao permitem acesso direto por anonimos ou usuarios. RPCs de preferencias/registro usam auth.uid(). Claims, validacao e resultados sao exclusivos do papel service_role.
- A selecao usa somente uma instalacao recente por conta; no maximo cinco sao mantidas. Desativar ambos os tipos revoga os destinos de todos os aparelhos da conta. Sair remove somente o aparelho atual. Nao ha envio remoto para visitante/iOS/web nesta versao; os lembretes locais anteriores em Android/iOS continuam funcionando.
- Claims sao unicos por evento e conferidos novamente antes de enviar. Se a resposta HTTP se perder, o envio nao e repetido automaticamente. E preferivel perder um convite a duplicar mensagens. O fornecedor ainda pode atrasar/duplicar entrega; notificacoes nao sao um canal garantido.
- Tickets do Expo sao conferidos apos 15 minutos. Tokens invalidados pelo fornecedor sao removidos. O status `accepted` significa aceito pelo FCM, nao entregue/lido no aparelho. Pendencias com mais de 24 horas viram `unknown`.
- Destinos inativos e eventos sao eliminados apos 30 dias durante os ciclos do dispatcher, mesmo com o envio global pausado. Preferencias permanecem ate excluir a conta. Se a funcao agendada parar de executar, a limpeza periodica tambem pausa.
- O texto generico das notificacoes nao inclui nomes, respostas, XP ou detalhes de amigos. Ao tocar, so e possivel abrir Aprender, com verificacao da conta de destino.

## Verificar antes da liberacao

Android real: primeiro consentimento, recusa de permissao, app fechado, saldo zero recuperando, recarga completa, janela noturna, revogacao no sistema, token renovado, saida offline, troca/exclusao de conta e clique em aviso antigo de outra conta. Saldos de teste devem ser preparados em ambiente separado, nunca alterar usuarios reais para testar.

No checkout: `npm test`, `npm run typecheck`, `npm run typecheck:tests`, `npm run lint` e `npm run test:e2e -- tests/e2e/pushNotifications.spec.ts`. Os testes usam um banco temporario e respostas simuladas; nao comprovam entrega FCM real nem publicacao da Edge Function.

Nenhuma mensagem remota, job de cron, secret ou configuracao de producao foi ativada pelo agente. Nao foi criada uma chave de conta de servico nem alterado o plano Firebase.

## Referencias oficiais

- https://docs.expo.dev/push-notifications/fcm-credentials/
- https://docs.expo.dev/versions/v57.0.0/sdk/notifications/
