# Amigos e XP semanal

Implementado em 15/10/2026. Codigo e verificacoes locais, ainda nao aplicado ao
Supabase de producao nem incluido em um novo AAB.

## Regras

- XP total: a RPC anterior continua intacta, com os mesmos valores e desempate.
- XP semanal: segunda 00:00 ate a segunda seguinte 00:00, America/Sao_Paulo.
  Soma xp_events de lesson_completed dentro do intervalo [inicio,fim).
  Importacoes de visitante nao contam como XP novo da semana. Uma tentativa
  offline entra quando o servidor confirma o ganho, nao pela data do aparelho.
  Nao ha tarefa agendada, exclusao de eventos ou reset do XP total.
- Amigos: XP total da propria conta e de amizades aceitas; pedidos pendentes
  nao entram. A classificacao e relativa ao grupo de amigos de quem consulta.
- Os tres modos exibem os dez primeiros e a posicao da propria conta, mesmo
  fora dos dez. Empates usam UUID crescente, como no ranking original.
- Contas sem XP na semana continuam com zero. Alterar profiles.xp_total
  manualmente nao cria XP semanal nem historico de ganhos.
- Perfil > Comunidade > Amigos abre busca por prefixo do usuario (minimo tres
  caracteres), resultados limitados a vinte e sem pesquisa por email.
- Pedidos exigem aceitacao do destinatario. E possivel recusar, cancelar um
  pedido enviado e remover amizade com confirmacao. Sem chat ou notificacoes.
- Limites: cinquenta pedidos enviados pendentes, cem pedidos pendentes na
  verificacao do destinatario e duzentas amizades aceitas por pessoa.

## Habilitar no Supabase

1. Confira que esta no projeto Arca correto e mantenha o backup habitual.
2. Abra supabase/migrations/202610150001_friends_weekly.sql e execute seu
   conteudo completo no SQL Editor do Supabase, uma unica vez. Ele pressupoe
   as tabelas de aprendizado e o ranking total ja existentes.
3. A alteracao e transacional, cria a tabela social e as RPCs; nao reescreve
   perfis, XP, tentativas, curriculo ou resultados existentes. Clientes antigos
   continuam usando learning_leaderboard() sem argumentos.
4. Atualize a previa e teste com duas contas: enviar, aceitar, conferir o
   ranking de amigos, remover. Conclua uma licao nova para conferir o semanal.
5. Republique legal-site/dist no site de privacidade existente. A versao local
   foi atualizada com a visibilidade de usuarios e as relacoes de amizade.

Sem a migration, o ranking total continua funcionando e os modos novos
informam que precisam ser habilitados no servidor. Nao substituimos resultados
reais por pessoas ou pontuacoes ficticias.

## Protecoes e testes

- RLS limita linhas de amizade aos participantes. Escrita direta e proibida;
  as RPCs derivam a propria conta do JWT, sem aceitar um ID do remetente.
- Pares canonicos e bloqueios ordenados evitam duplicatas/requisicoes reversas.
- Busca e listas retornam somente ID, nome, usuario, avatar e relacao.
  Email, respostas, senha e metadados da autenticacao nao sao expostos.
- Exclusao da conta remove amizades e pedidos em cascata. Remover uma amizade
  nao apaga o XP nem altera o ranking global.
- Requisicoes sao vinculadas a conta; respostas antigas sao descartadas ao
  trocar de conta, foco ou modo de ranking. Falhas preservam listas carregadas.
- tests/social.test.ts executa as RPCs em PostgreSQL local (PGlite), incluindo
  consentimento, grants/RLS, limites, intervalos semanais, desempates e cascata.
- scripts/social-qa.mjs testa navegacao e acoes em 320/390/430/1280 pixels,
  troca rapida de modo, falha/repeticao e visitante com rede isolada e simulada.
  Nenhum usuario ou pedido real e criado pelos testes.
- Ainda precisa de teste no Supabase remoto com duas contas e no Android.
