# Refinamentos autonomos: 0.2.0

Data: 14/10/2026. Design, assets, XP, desbloqueios, ranking e autenticao existentes
foram preservados. Nenhum SDK de publicidade ou telemetria remota foi acrescentado.

## Estudo

Rascunhos guardam a identidade da tentativa, respostas iniciais, resposta atual,
feedback e fila de erros. Sair oferece Salvar e sair; so navega apos a gravacao.
Reabrir a mesma licao restaura esse estado. Um curriculo diferente invalida
o rascunho antigo. Conclusao remove seu rascunho e impede gravacoes tardias de
recria-lo. Uma falha de armazenamento nao concede XP novamente nem apaga os dados.

Historico guarda as 500 tentativas mais recentes, sem duplicar recibos.
Contas consultam recibos existentes em lesson_attempts usando seu token e RLS;
visitantes usam armazenamento local. Essa consulta nao altera tabelas.
Sem rede, resultados locais sao preservados. A tela avisa sobre sincronizacao
pendente ou rejeitada; o XP confirmado continua sendo o do Perfil.

Precisao por assunto soma acertos iniciais e total de perguntas, incluindo recibos
antigos com cinco perguntas. A meta usa a data local da conclusao: uma tentativa de
dez exercicios soma dez, sem acrescentar as repeticoes dos erros. Revisoes contam
como estudo, mas nao concedem XP. Nao sao contadas respostas de uma licao incompleta.

A revisao sugere somente licoes concluidas. Comeca em um dia; precisao >=80%
em revisoes no prazo aumenta para 3, 7, 14 e 30 dias. Precisao inferior reinicia
em um dia. Repetir varias vezes antes do prazo nao acelera os intervalos.
Nao ha notificacao automatica nem promessa de eficacia clinica/educacional.

## Preferencias e suporte

Som, vibracao, reducao de movimento e meta sao separados por conta/visitante.
A preferencia antiga de som continua sendo lida na migracao. Reducao de movimento
combina a opcao do app com a configuracao do sistema.

Ajuda e suporte abre uma mensagem no aplicativo de e-mail. Reportar pergunta
identifica licao e pergunta. O usuario confirma o envio; nao e um sistema de tickets.
Se nao houver aplicativo de e-mail, a tela mostra o contato.

Diagnosticos ficam apenas na memoria: no maximo 30 eventos conhecidos, horario e
duracao. O e-mail inclui no maximo dez, somente quando autorizado na tela.
Nao inclui texto bruto de erros, stack, senha, token, conta, respostas ou IP.
Nao substitui monitoramento de falhas nativo ou remoto em producao.

## Dados e exclusao

- arca.study.<escopo>.v1: rascunhos e historico.
- arca.preferences.<escopo>.v1: preferencias.
- Escopo: UUID da conta ou guest; nada e compartilhado entre contas.
- Exclusao confirmada limpa essas duas chaves da conta, alem das anteriores.
- Escritas atrasadas da conta excluida sao rejeitadas pelo guard de armazenamento.
- Visitante e outras contas permanecem intactos.

Preferencias, detalhes dos rascunhos e identificacao dos erros nao sincronizam
entre aparelhos nesta versao. Recibos remotos permitem recuperar historico,
mas nao inventam tentativas que o banco nao tenha registrado.

## Verificacao

- 189 testes automatizados passaram apos os patches das dependencias.
- TypeScript e lint passaram.
- Expo Doctor: 21/21.
- Exportacao Android Metro/Hermes: compilada com 62 assets.
- Scripts de navegador: study-qa.mjs, lesson-retry-qa.mjs e privacy-qa.mjs.
- Fluxos novos passaram em 320, 390, 430 e 1280 pixels, sem erros de pagina.
- Regressao de privacidade passou em 320, 390 e 430 pixels com conta ficticia.
- Capturas em artifacts/screenshots/study e artifacts/screenshots/privacy.

Uma interrupcao da promessa de reproducao do navegador foi encontrada e corrigida
com um adapter web que trata cancelamento. Os players HTML continuam reutilizados;
os players nativos Expo Audio nao foram substituidos.

Os scripts usam armazenamento isolado e rede simulada, nunca credenciais reais.
O teste de instalacao Android, som fisico, vibracao, links reais de recuperacao
e exclusao remota continuam pendentes. Uma exportacao nao e um AAB assinado.

## Roteiro no celular

1. Atualize sem desinstalar e confira conta, XP e desbloqueios anteriores.
2. Erre uma pergunta, salve e saia; encerre o app; reabra e retome o feedback.
3. Termine a licao corrigindo os erros; confira precisao inicial e XP uma unica vez.
4. Mude a meta para 20 e as preferencias; reabra e confira a persistencia.
5. Abra Historico e Revisao. Revise concluida e confirme +0 XP.
6. Troque de conta: historico e preferencias nao devem vazar entre identidades.
7. Abra suporte e reporte uma pergunta; confirme destinatario sem enviar no teste.
8. Com conta descartavel, teste exclusao e ausencia dos dados locais da conta.
