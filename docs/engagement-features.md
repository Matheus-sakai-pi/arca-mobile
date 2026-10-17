# Desafios, lembretes, resumo semanal e diagnostico

## Acesso

- Perfil > Comunidade > Desafios entre amigos; tambem acessivel em Amigos.
- Perfil > Estudo > Resumo semanal e Lembrete de estudo.
- Inicio > Meu resumo semanal.
- Dashboard separado > Diagnostico. Nenhuma tela administrativa no app.

## Ativacao

Aplicar `supabase/migrations/202610160001_challenges_insights.sql` uma vez, depois das migracoes existentes de amizades e relatos/admin. Depois aplicar `supabase/migrations/202610160002_challenges_ten.sql` para os desafios de dez perguntas. Nao repetir migracoes ja aplicadas. O pacote `artifacts/admin-setup` contem os arquivos para SQL Editor. Sem credenciais administrativas, nenhuma alteracao remota e feita automaticamente.

## Contratos

Desafios: amizade aceita, convite explicitamente aceito, dez perguntas disponiveis em comum e congeladas no servidor, prazo de sete dias. Usa os formatos existentes, incluindo classificacao, associacao, ordenacao, correcao de frase e selecao multipla. Exclui leituras e resumos dependentes de leitura. A primeira licao oferece dez perguntas mesmo para contas novas. Uma submissao por participante, idempotente para payload identico. Comparacao de acertos visivel somente quando ambos terminam. Sem XP, streak, desbloqueio de licoes, chat ou emails. Recusar/cancelar permitido apenas para o destinatario/remetente enquanto pendente. Dez convites por dia/remetente, vinte abertos/destinatario e um aberto por par. Lista limitada aos cem desafios mais recentes. Rascunhos pertencem a conta e sao removidos no fluxo de exclusao. Desafios antigos preservam as cinco perguntas, recibos, placares e retomada. O cliente deriva o tamanho da tentativa e nao recebe solucoes reais no payload de jogo.

Lembrete: um horario diario por aparelho, inicialmente desligado, notificacao local sem token push. Permissao solicitada somente ao ativar. Horario local, sem permissao de alarme exato; o sistema pode atrasar a entrega. Estado e agendamento serializados, com tentativa de restauracao se houver falha. Revogacao de permissao e agendamento ausente desativam a preferencia ao abrir a tela. Nao ha notificacoes web. Preferencia generica do aparelho nao pertence a conta e pode continuar apos logout. Nova compilacao nativa necessaria; entrega em aparelho real ainda requer verificacao.

Convite de lembrete: aparece na tela de resultado apos tres licoes diferentes concluidas, sem contar repeticoes da mesma licao. Espera um segundo para o resultado aparecer. Nao exibe se o lembrete ja esta ativo ou se o convite ja foi respondido neste aparelho/conta. Escolher horario abre a configuracao, sem pedir permissao ou ativar automaticamente. Agora nao, X e voltar do Android dispensam o convite; a escolha fica local e e removida na exclusao da conta. Na web, informa que a ativacao so existe no app nativo. Falha de leitura local oculta o convite; falha de gravacao nao impede recusar.

Resumo: janela de sete datas locais, incluindo hoje, com navegacao por periodos anteriores. Historico existente ate 500 tentativas; revisoes contam exercicios/conclusoes, nao XP novo. Acuracia ponderada por exercicios. Comparacao entre assuntos exige dez respostas em cada periodo. Historico local pendente/rejeitado e sinalizado.

Diagnostico: somente administradores autorizados pelo banco. Ultimos trinta dias, sem dados individuais nas tabelas de estatistica. Erros usam respostas iniciais de conclusoes existentes e somente amostras de cinco ou mais respostas posteriores a ativacao e a ultima atualizacao do conteudo. Edicoes de perguntas atualizam a data da revisao. Relatos recorrentes agrupam pelo identificador da pergunta. Sessoes usam chave da tentativa, sobrevivem a retomadas e sao marcadas concluidas por recibos do banco; nao sao app opens. Falha no registro nunca bloqueia a licao e nao inventa dados offline. Sem conclusao por 24h nao significa abandono definitivo. Exclusao da conta remove as sessoes e desafios vinculados.

## Lancamento

- Republicar a politica publica a partir de `legal-site/dist` e revisar Seguranca dos dados.
- Aplicar a migracao e confirmar acesso administrativo.
- Gerar novo AAB antes de publicar o app.
- Testar Android/iOS real: permissao negada, ativar, alterar horario, fechar app, receber alerta, desativar e reiniciar aparelho. Nao usar apenas o navegador para validar entrega.
