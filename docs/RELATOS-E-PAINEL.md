# Relatos no app e painel separado

Implementado em 15/10/2026. O painel e um SITE independente em ../arca-dashboard.
Nao ha rota /admin, menu administrativo ou componente de dashboard no app.

## Na licao

A antiga acao grande que abria email foi substituida por bandeira pequena e
Reportar problema. Uma janela permite escolher entre cinco motivos e enviar
comentario opcional de ate 1000 caracteres. O motivo e obrigatorio.
Depois do recibo confirmado, aparece Relato recebido e a pessoa volta para
a mesma pergunta, sem alterar sua resposta, progresso, XP ou fila de exercicios.

Somente contas autenticadas podem enviar; visitante recebe aviso e pode voltar
a licao sem fazer login nem perder a tentativa. Nao existe envio anonimo aberto.
Falhas preservam o formulario. Repetir o envio usa a mesma chave enquanto o
conteudo nao mudar. Fechar a licao/trocar de conta cancela o pedido do cliente;
uma resposta atrasada nao aparece para outra identidade.

Nao enviamos email, push ou alerta externo ao proprietario. O suporte geral
continua sendo um contato por email; e um fluxo diferente.

## Persistencia e seguranca

- RPC submit_question_report deriva o remetente do JWT, nunca de um UUID enviado pelo app.
- Validacao de pergunta/licao publicadas em curso/unidade publicados.
- Copia da pergunta e resposta vem do banco, nao de texto enviado pelo cliente.
- Chave de requisicao idempotente, no maximo um relato da mesma pergunta por pessoa a cada 24 horas e dez relatos em 24 horas.
- Tabelas question_reports e arca_admins com RLS e sem acesso direto anon/authenticated, inclusive para o administrador.
- Consultas/mudancas administrativas exigem permissao no servidor; nao dependem do email escrito no navegador.
- Status New/Reviewing/Resolved. Abrir nao resolve. Salvar exige timestamp esperado, rejeitando alteracoes concorrentes.
- Exclusao da conta apaga relatos/comentarios em cascata e remove a permissao administrativa, se existente.
- Sem rastreamento novo de abertura do app, geolocalizacao, visitas anonimas ou SDK de analytics.

## Ativar

1. No SQL Editor do projeto Arca, executar uma vez a migration 202610150003_reports_admin.sql.
2. Conferir a conta propria matheussakai23032001@gmail.com em Authentication; precisa ter email confirmado.
3. Executar supabase/admin-access.sql para autorizar APENAS seu UUID atual.
4. Abrir o site separado e entrar com essa conta. Outra conta deve receber Acesso restrito.
5. Na previa nova do app, enviar um relato com conta de teste e verificar no painel. Nao usar dados sensiveis no comentario.

Scripts prontos para o SQL Editor em artifacts/admin-setup/. Nenhuma migration
ou permissao foi aplicada automaticamente em producao nesta implementacao.
O AAB codigo 5 continua com o botao antigo; sera necessario um novo build para
levar a mudanca ao Android distribuido. Politica local e legal-site/dist foram
atualizados e precisam ser republicados no site de privacidade.

## Indicadores iniciais

Contas totais e novas em sete dias, pessoas distintas com conclusao em sete dias,
quantidade de recibos de licoes/revisoes no periodo e status dos relatos.
Grafico diario dos ultimos 14 dias em UTC. Visitantes nao entram nesses totais;
contas administrativas/testes existentes no banco contam como contas.
O painel nao afirma medir quem apenas abriu o app e nao possui planos pagos.

## Validacao

Testes locais com PostgreSQL: autenticacao, falta de privilegio, auto-promocao
negada, copia historica, recibos/repeticoes, cota, filtros, paginacao, concorrencia,
metricas de estudo e exclusao. Navegador isolado: formulario com falha/repeticao,
preservacao da licao e leitura no site separado. Nenhum email ou relato real.
