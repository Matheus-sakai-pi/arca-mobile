# Energia: implementacao e ativacao

## Regras

- Capacidade de 5; recuperacao continua de 1 a cada 4 horas, sem acumular acima de 5.
- Cada licao nova consome energia desde a primeira, sem gratuidade introdutoria.
- O consumo de 1 energia acontece automaticamente ao abrir uma nova licao, sem tela de confirmacao. Sem saldo, o app mostra a espera pela recarga e o acesso as revisoes.
- Autorizacao permanente por conta e licao: pausa, reinicio, perda de resposta, outro aparelho e retomada nao cobram novamente.
- Revisoes de licoes concluidas, correcoes e desafios nao consomem energia.
- Contas precisam de conexao para novas autorizacoes; um comprovante local permite retomar offline. A conclusao e o XP continuam sujeitos a validacao no servidor.

## Implantacao segura

1. Aplique todas as migracoes anteriores ainda pendentes no projeto correto do Supabase.
2. Aplique `supabase/migrations/202610160003_learning_energy.sql`. A restricao fica **desligada** por padrao. O SQL nao apaga XP, perfil, licoes, tentativas ou conquistas. Inicios ja registrados no servidor recebem autorizacao gratuita de transicao.
3. Distribua uma nova versao compativel do aplicativo. Esta tarefa nao gera um novo AAB automaticamente.
4. Mantenha a restricao desligada durante a atualizacao e sincronizacao das filas offline antigas. Contas com novas tentativas offline sem inicio registrado precisam sincronizar antes de ativar. Nunca descarte filas antigas para forcar a migracao.
5. No painel separado, abra Energia e ative para um grupo pequeno. A selecao usa um grupo estavel calculado pelo identificador da conta.
6. Compare conclusoes, bloqueios e retorno ao estudo. Libere gradualmente. Visitantes recebem a restricao somente quando a liberacao chegar a 100%.
7. Desligue pelo painel se houver problemas. Saldos e autorizacoes permanecem; nao e necessario alterar XP ou restaurar backups.

## Atualizacao: todas as contas

A migracao `202610160004_energy_all_accounts.sql` substitui a isencao das tres primeiras licoes por consumo desde a primeira e ativa a restricao para 100% das contas e visitantes. Aplique-a apos a migracao de energia anterior e use a nova versao do app. A primeira migracao isolada ainda instala a energia desligada; a segunda efetivamente ativa o consumo. O painel continua permitindo desligar a restricao em uma emergencia.

Nao existe cobranca retroativa: licoes concluidas e autorizacoes de licoes ja iniciadas sao preservadas. O indicador de energia fica junto da sequencia e do XP, e abre os detalhes ao ser tocado.

Instalar o SQL e publicar a nova versao sao etapas distintas. O app detecta um servidor antigo sem os RPCs e preserva o fluxo anterior, mostrando a energia como ainda indisponivel. Outros erros nao autorizam novas licoes automaticamente. Clientes antigos nao conseguem concluir novas licoes restritas sem uma autorizacao valida depois da ativacao; por isso nao ative antes da atualizacao.

## Offline, visitante e importacao

O visitante usa armazenamento local. Reinstalacao e manipulacao dos dados/relogio podem contornar esse limite; ele nao tem as garantias do servidor. A politica de ativacao e consultada com prazo curto, guardada no aparelho e reaproveitada offline. Uma alteracao remota so chega ao aparelho quando houver conexao.

Rascunhos validos de visitantes anteriores a primeira inicializacao da energia recebem acesso gratuito de transicao. A energia da conta e isolada por identificador e incluida na exclusao local. Caches corrompidos de contas so sao substituidos apos confirmacao do servidor e copia de seguranca; caches de visitantes corrompidos nao sao reiniciados silenciosamente.

Importar progresso de visitante nao concede energia extra. O servidor confere a origem da importacao, aplica no maximo uma transferencia e aceita somente reducao do saldo. O prazo de recuperacao transferido e limitado a quatro horas. Rascunhos de visitante continuam no escopo visitante, como antes; nao sao copiados automaticamente para a conta.

## Controle e diagnostico

As tabelas de energia nao permitem acesso direto a clientes anonimos ou autenticados. RPCs usam `auth.uid()`, bloqueio da linha do perfil e transacoes. O horario de recuperacao de contas vem do PostgreSQL, nao do aparelho. A conclusao de uma nova licao restrita exige autorizacao no banco, inclusive para clientes antigos.

`arca_admin_energy` e `arca_admin_energy_update` exigem um administrador existente. A atualizacao exige a data da configuracao lida, evitando sobrescrever outra sessao. O painel nao altera o saldo individual.

Indicadores de sete dias: autorizacoes com consumo, quantas foram concluidas, contas bloqueadas, consultas de inicio sem saldo e contas que concluiram uma licao ou revisao apos o ultimo bloqueio registrado no periodo. Nao sao medidas de abertura do app ou abandono definitivo. Visitantes nao entram nessas estatisticas.

## Verificacao

`npm run check` executa lint, tipos, testes unitarios, PostgreSQL e Playwright. `npm run test:e2e -- energy.spec.ts` executa somente os cenarios visuais de energia nos tres tamanhos de tela.

Cobrir no Android real antes da liberacao: voltar do segundo plano, pausa, encerramento do processo, retomada offline, mudanca de conta, exclusao e modo aviao. Verificar a politica publica atualizada antes de publicar; gerar `legal-site/dist` nao publica automaticamente o site legal.

Nao ha anuncios, compras de recarga, gemas ou assinatura implementados nesta versao.
