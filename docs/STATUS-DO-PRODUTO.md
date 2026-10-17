# Arca: checklist de melhorias

Atualizado em 15/10/2026. "Implementado" indica codigo e testes locais, nao
disponibilidade automatica na versao instalada pela Google Play.
Este registro consolida o trabalho confirmado; nao presume que uma decisao
futura ou uma declaracao preenchida prove uma funcionalidade.

## Implementado e verificado localmente

- [x] 100 licoes, dez unidades e 1.000 exercicios, com IDs anteriores preservados.
- [x] Dez exercicios por licao; erros retornam ate serem corrigidos.
- [x] XP da primeira resposta, conclusao idempotente e revisao sem XP adicional.
- [x] Retomar tentativa no mesmo aparelho, incluindo resposta, feedback e fila.
- [x] Revisao espacada por licao concluida: intervalos de 1, 3, 7, 14 e 30 dias.
- [x] Meta diaria configuravel: 10, 20 ou 30 exercicios.
- [x] Historico das ultimas 500 tentativas e precisao recente por assunto.
- [x] Preferencias locais separadas por conta/visitante: som, vibracao e animacoes.
- [x] Ajuda no Perfil e reporte de pergunta por e-mail, com identificacao da questao.
- [x] Diagnostico limitado, temporario e opcional; nenhum envio automatico.
- [x] Tela de recuperacao de falha de renderizacao, sem apagar progresso.
- [x] Limpeza de historico, rascunhos e preferencias na exclusao da conta.
- [x] Auditoria estrutural do curriculo: nenhuma falha encontrada nos 1.000 exercicios.
- [x] Ensaio local de backup/restauracao com RLS e XP idempotente.
- [x] Revisao de dependencias e patches oficiais compativeis do Expo SDK 57.
- [x] Protecao de entrada de links nativos malformados; risco transitivo continua aberto.
- [x] Politica local e paginas externas geradas com o tratamento novo de dados.
- [x] AAB 0.2.0 / versionCode 4 gerado, baixado e validado, com assinatura anterior preservada.
- [x] AAB 0.3.0 / versionCode 5 gerado em 15/10/2026, baixado e validado com a mesma assinatura.
- [x] AAB 0.3.0 / versionCode 6 gerado em 17/10/2026, baixado e validado com a mesma assinatura. Inclui o codigo atual; ativacoes remotas nao sao automaticas (ver PLAY-STORE.md e ENERGY-V2.md).

## Ajustes visuais posteriores ao AAB 4

- [x] Logo branca enviada pelo proprietario no cabecalho do Inicio, sem alterar a imagem.
- [x] Cenario do Inicio e do Perfil acompanha a rolagem somente na abertura,
  com transicao para fundo claro nas listas abaixo. Aprender e as trilhas
  mantem o cenario continuo ate o fim da lista.
- [x] Aprender com dez ilustracoes distintas, cards inspirados na referencia e progresso real.
- [x] Cada unidade abre sua trilha em tela propria, com volta, acesso sequencial e CTA de licao.
- [x] Nove icones proprios para as conquistas, no Perfil e nos avisos de desbloqueio,
  com estados bloqueado/desbloqueado e criterios de ganho preservados.
- [x] Inicio com meta compacta, retomada da licao com play e acoes de estudo alinhadas.
- [x] Perfil com lista de acoes agrupada em Conta, Suporte e Sessao; exclusao separada.
- [x] Ranking com titulo sobre o cenario, podio proporcional, nomes sem reducao
  automatica de fonte e lista unica com divisorias e identificacao de "Voce".
- [x] Painel de sequencia e XP do Ranking inspirado na referencia, com dados reais.
- [x] Numeros do podio centralizados na frente das colunas, inclusive com nomes longos.
- [x] Tres modos reais de ranking: XP total, XP semanal e amigos aceitos.
- [x] Amigos no Perfil: busca por usuario, pedidos, aceitacao, recusa e remocao.
- [x] Nome publico unico escolhido no cadastro, verificado no servidor, e aviso
  para contas antigas escolherem sem renomeacao automatica ou perda de dados.
- [x] Formulario de relato dentro da licao, sem email, com motivo, comentario opcional e recibo.
- [x] Dashboard em site separado (../arca-dashboard), sem rota administrativa no aplicativo.
- [ ] Ativar SQL de relatos e permissao da conta administrativa no Supabase remoto.
- [x] SQL social/semanal testado em PostgreSQL local; dados privados protegidos por RLS.
- [x] Previa web verificada em 320, 390, 430 e 1280 pixels; 216 testes passaram.
- [x] Esses ajustes incluidos no AAB 0.3.0 / versionCode 5.

## Ja realizados pelo proprietario

- [x] Primeiro AAB 0.1.0 / versionCode 2 publicado em teste interno.
- [x] Paginas publicadas em arca-politica.netlify.app.
- [x] Funcao delete-account publicada pelo editor Supabase, conforme relato.
- [x] Declaracoes de Conteudo do app preenchidas no Play Console, conforme relato.

Esses relatos nao substituem teste da exclusao real, conferencias de configuracao
ou revisao da veracidade de cada declaracao.

## Parcial ou aguardando verificacao externa

- [ ] Coordenar as migrations compativeis e enviar o AAB 0.3.0 / versionCode 6 ao teste interno. Arquivo pronto em artifacts/releases.
- [ ] Instalar a nova versao pela loja e testar atualizacao sem desinstalar.
- [ ] Confirmar aplicacao remota de 202610140001_ten_exercises.sql.
- [x] Endpoints remotos de XP semanal e disponibilidade de nome respondem HTTP 200,
  com formatos validos, em consultas somente de leitura realizadas em 15/10/2026.
- [ ] Testar amigos/XP semanal com duas contas reais e conferir pedidos/aceitacao.
- [ ] Conferir cadastro e escolha de nomes reais no Android.
- [ ] Testar login, recuperacao, audio, vibracao, botao voltar e exclusao no Android.
- [ ] Republicar legal-site/dist no mesmo site para atualizar o texto publico.
- [ ] Sincronizar preferencias, rascunhos e conquistas entre aparelhos. Sao locais.
- [ ] Monitoramento remoto de falhas. Ha apenas diagnostico local opcional.
- [ ] Backup real do projeto Supabase, politica de retencao e ensaio em ambiente isolado.
- [ ] Resolver os 29 alertas npm restantes com correcoes oficiais compativeis.
- [ ] Revisao editorial/factual integral e validacao dos direitos das referencias visuais.
- [x] Materiais da loja preparados em artifacts/play-store/2026-10-15: textos pt-BR,
  icone 512x512, destaque 1024x500, oito capturas web 1080x1920 e textos alternativos.
- [ ] Conferir/substituir capturas pelo Android instalado e aprovar/enviar materiais da loja.
- [ ] Conta exclusiva de avaliacao: acesso completo e senha segura conferidos pelo proprietario.
- [ ] SMTP, limites de e-mail, testadores e exigencias de acesso a producao da conta.

## Decisoes que nao foram tomadas automaticamente

- Ranking por cidade: ideia futura, sem coleta de cidade implementada nesta entrega.
- Local aproximado no Play: permanece marcado por decisao do proprietario; coleta
  atual nao foi comprovada pelas consultas mostradas. Intencao futura nao prova coleta.
- Reacoes a violencia no questionario: resposta provisoria requer conferencia do conteudo.
- Notificacoes, publicidade, compras, grupos, IA e novos fornecedores: nao adicionados.
- EAS Update: nao configurado, conforme pedido.
- Publicacao em producao, cobranca, troca de chave de assinatura e restauracao de
  banco real: nao realizadas.

Detalhes: REFINAMENTOS-AUTONOMOS.md, SEGURANCA-E-BACKUP.md e FICHA-DA-LOJA.md.
