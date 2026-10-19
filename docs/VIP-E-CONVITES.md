# Arca VIP e convites

Concessao administrativa gratuita para testes: consulte `docs/VIP-ADMINISTRATIVO.md`. Ela usa registros privados separados, com vencimento e revogacao, sem simular compras nem alterar a verificacao Google Play.

## Implementado no projeto

- Tela `/vip`, entrada no Perfil, avatares originais e exclusivos (2), restauracao de compras e gerenciamento na Google Play.
- Personalizacao em Perfil: molduras Dourada, Oliveira e Estelar; fundos Jardim, Ceu e Constelacao; selo VIP opcional. Detalhes e artes em `docs/PERSONALIZACAO-VIP.md`. O beneficio de convites nao libera esses estilos.
- Assinatura `arca_vip`, planos base `mensal` (R$ 19,90/mes) e `anual` (R$ 99,90/ano). O checkout sempre usa a oferta e o preco recebidos da Play, nao um preco inventado pelo aplicativo.
- Bateria ilimitada por assinatura; +10% do XP de uma nova licao, arredondado para baixo. Revisao nao repete XP. Exemplo: 35 XP vira 38 XP. Recibos, perfil, ranking semanal, historico e atividade diaria ficam consistentes.
- Recompensa por convite: quem convida e quem aceita recebem 3 dias de bateria ilimitada apos a primeira licao valida do convidado, sem os outros beneficios VIP. Os dias acumulam sobre o prazo ativo de cada conta. Sem confirmacao de e-mail adicional para a recompensa.
- O cadastro aceita codigo, pede consentimento explicito para amizade e cria amizade aceita automaticamente. Nao transforma solicitacoes comuns em amizades automaticas.
- WhatsApp abre uma mensagem, nao envia sem intervencao do usuario. O link da Play leva o codigo no Install Referrer; o cadastro Android le e preenche esse codigo. Tambem existe entrada manual.
- So uma recompensa por convidado e por identificador Android premiado. A primeira licao exige tentativa completa com respostas registradas no servidor, sem usar importacao de visitante como comprovante.
- O saldo normal permanece guardado e recarrega durante o beneficio. A cobranca volta ao normal quando ele expira. O servidor valida todas as respostas tambem para VIP.
- Conexao obrigatoria, como nas licoes atuais; nao ha saldo ou VIP provisoria/offline concedidos pelo cliente.
- Um avatar VIP ja escolhido permanece depois do vencimento; escolher outro exclusivo exige assinatura ativa.

## Ativacao pendente (nao foi publicada automaticamente)

1. Aplicar `supabase/migrations/202610180004_vip_referrals.sql` no projeto Supabase existente, depois das migrations anteriores. A copia pronta esta em `artifacts/membership/ativar-vip-convites.sql`. Depois, aplicar `202610180005_referral_rewards_both.sql` (copia pronta: `artifacts/membership/atualizar-convites-duplos.sql`) para premiar os dois participantes e `202610180006_profile_appearance.sql` (copia pronta: `artifacts/membership/ativar-personalizacao-vip.sql`) para guardar os estilos VIP. Executar somente as migrations ainda nao aplicadas. Nao executar novamente a instalacao original nem o pacote antigo de bateria.
2. Na Play Console de `com.arca.mobile`, criar a assinatura `arca_vip`. Criar planos base autorrenovaveis `mensal` e `anual`, com periodos P1M/P1Y e precos brasileiros R$19,90/R$99,90. Ativar os dois planos, sem periodos de teste/ofertas nesta primeira configuracao. Outros paises precisam dos precos locais escolhidos na Console. Alterar os valores de referencia do app nao muda os precos cobrados pela Play; os dois lados precisam ser atualizados.
3. Ativar Android Publisher API no Google Cloud. Autorizar uma conta de servico na Play Console para consultar compras e gerenciar assinaturas. A credencial de FCM usada para push nao recebe essa permissao automaticamente.
4. Configurar somente nos secrets da Edge Function: `GOOGLE_PLAY_CLIENT_EMAIL`, `GOOGLE_PLAY_PRIVATE_KEY`, `PLAY_BILLING_CRON_SECRET` (aleatorio, forte), `GOOGLE_PLAY_RTDN_EMAIL` e `GOOGLE_PLAY_RTDN_AUDIENCE`. A audiencia e a URL HTTPS exata de `play-billing`. `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` sao secrets internos do Supabase. Nunca colocar chave privada no .env publico, app.json, Git ou chat.
5. Publicar a funcao `play-billing` com `supabase functions deploy play-billing --no-verify-jwt`. O handler verifica o JWT do usuario, o OIDC do Google ou o secret do agendador, conforme a operacao. Nenhum dado de compra enviado pelo app decide validade ou prazo.
6. Criar topico Pub/Sub, autorizar o publicador da Google Play e configurar RTDN na Play Console. Criar assinatura push autenticada para a funcao com OIDC, e-mail da conta de servico e audiencia iguais aos secrets. Notificacoes apenas disparam nova consulta a Google; nao concedem beneficios diretamente. Enviar notificacao de teste.
7. Agendar POST para a mesma funcao a cada 5 minutos, cabecalho `Authorization: Bearer <PLAY_BILLING_CRON_SECRET>`, corpo `{"action":"reconcile"}`. Cada execucao verifica ate oito recibos com verificacao antiga (>1h); acompanhar `failed` e aumentar capacidade antes de escalar. Guardar secret no Vault/gerenciador de secrets, nunca num arquivo SQL publicado. Conferir execucoes reais.
8. So depois do servidor, RTDN e agendamento funcionarem: `update public.membership_config set billing_enabled=true where singleton;`. O padrao e false para nao oferecer pagamento sem verificacao pronta.
9. Gerar novo build Android via EAS (a dependencia nativa mudou), distribuir por teste interno da Play, configurar testadores de licenca e testar com meios de pagamento de teste. Nao ha compra real na previa web nem teste de cobranca real concluido nesta implementacao.

## Seguranca e limites

A regra de recompensa dupla vale para convites ainda nao premiados e novos convites apos a atualizacao. Convites ja premiados pela regra antiga mantem seus recibos e prazos, sem recalculo retroativo. A atualizacao SQL pode ser repetida sem conceder dias extras: os dois creditos e o recibo sao gravados na mesma transacao. Os arquivos de instalacao inicial continuam separados para nao tentar recriar tabelas existentes.

A previa web usa os textos novos, mas o AAB versionCode 8 foi gerado antes desta mudanca. Ele nao e atualizado automaticamente. Para levar os textos novos ao Android sera necessario gerar outro AAB; a regra de recompensa e autoritativa no Supabase.

O backend consulta subscriptionsv2, verifica produto/plano e vinculo SHA-256 do usuario com obfuscatedAccountId, reconhece a compra no Google e so entao salva. O token e privado, unico e nao pode ser transferido entre contas. Pendente nao libera VIP. Ativa, carencia e cancelada ainda dentro do periodo pago permitem acesso; suspensa, pausada, expirada e revogada nao. RTDN atualiza rapidamente; reconciliacao cobre perda de eventos. Beneficios pagos deixam de valer sem nova verificacao por 24h, mesmo se o periodo registrado for maior. Assim uma falha prolongada do servidor nao deixa VIP irrevogavel. A UI mostra a data do periodo pago, nao o prazo interno de revalidacao.

O identificador usado nos convites e o Android ID especifico da combinacao aplicativo/assinatura e usuario do sistema, resumido com SHA-256. Contas conhecidas no mesmo identificador sao inelegiveis, mesmo em outras instalacoes. A web nao simula um identificador Android. Cadastros feitos nela podem aceitar amizade, mas aguardam acesso Android antes da validacao de recompensa.

**Limite importante:** esse identificador vem de um cliente e nao e uma prova criptografica do aparelho. Aparelhos modificados, varios perfis Android, clonagem e clientes adulterados podem contornar a protecao basica. Para uma garantia mais forte, o proximo endurecimento e Play Integrity com verificacao no servidor e limites de velocidade. Nao prometer deteccao infalivel de um unico celular. Nao existe verificacao obrigatoria de e-mail nesta regra, por escolha do produto. O registro anonimo de aparelhos premiados fica retido para nao premiar recriacao de contas; a politica de privacidade explica a retencao.

Excluir a conta nao cancela a assinatura da Play. A tela de exclusao avisa isso. Recibos ficam desvinculados e sem permissao de transferencia; convites, beneficios e aparelhos associados seguem as chaves estrangeiras da exclusao.

## Arquivos e verificacao

- Configuracao do app: `src/config/membership.ts`; configuracao autoritativa e feature flag: `membership_config`.
- Backend: migration acima e `supabase/functions/play-billing/index.ts`.
- Testes SQL/contratos: `tests/integration/membership.test.ts`, `tests/unit/membership.test.ts`.
- Testes web: `tests/e2e/membership.spec.ts`, em 320px, 390px e desktop.
- Nao ha teste de pagamento real nem atestacao Play Integrity nesta etapa.

Validacao local em 18/10/2026: 309 testes unitarios/integracao passaram; 9 cenarios Playwright novos e 42 de regressao passaram (tres tamanhos). Typecheck do app, typecheck dos testes e verificacao Deno da Edge Function passaram. Capturas finais em `artifacts/membership/screenshots/`. A previa principal continua em `http://localhost:8089`; os testes usam outra porta e outra base.

Referencias oficiais consultadas: [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/), [compras no Expo](https://docs.expo.dev/guides/in-app-purchases/), [expo-iap/OpenIAP](https://www.openiap.dev/docs/setup/expo), [seguranca Play Billing](https://developer.android.com/google/play/billing/security), [ciclo de assinaturas](https://developer.android.com/google/play/billing/lifecycle/subscriptions), [Install Referrer no Expo](https://docs.expo.dev/versions/v57.0.0/sdk/application/).

## Arte original

Gerada com a ferramenta integrada de imagens, em dois pedidos independentes; PNGs finais reduzidos para 512x512 no workspace:

- `assets/avatars/vip-sage.png`: retrato 3D cartoon de um viajante biblico idoso, barba prateada, tunica clara, manto verde-azulado bordado e pergaminho, fundo menta, enquadramento para avatar circular, sem texto nem marcas.
- `assets/avatars/vip-explorer.png`: retrato 3D cartoon de um explorador adulto com cachos escuros, pele morena, manto azul bordado, tunica branca e alca de bolsa, fundo azul-claro, sem texto nem marcas.

Nenhuma arte ou personagem do aplicativo de referencia foi reutilizado.
