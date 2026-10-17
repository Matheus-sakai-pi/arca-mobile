# Seguranca e backup: revisao tecnica

Revisao em 14/10/2026. Nao e certificacao de seguranca ou conformidade legal.

## Dependencias

npm audit --omit=dev: 29 alertas, 18 high e 11 moderate, nenhum critical.
Relatorio: artifacts/dependency-audit-2026-10-14.json. Os 29 nao sao 29 falhas
independentes: o npm conta tambem pacotes afetados transitivamente.

Patches recomendados pelo Expo aplicados, preservando SDK 57/RN 0.86:
expo 57.0.29, asset 57.0.20, constants 57.0.22, linking 57.0.13 e router 57.0.27.
Expo Doctor passou 21/21; esses patches nao eliminaram os alertas abaixo.

| Dependencia | Alcance observado | Estado |
| --- | --- | --- |
| braces 3.0.3 | Ferramentas Metro/CLI, padroes manipulados na compilacao | Sem versao corrigida publicada na consulta |
| node-forge 1.4.0 | Ferramentas de certificados/assinatura no desenvolvimento | Sem versao corrigida publicada na consulta |
| decode-uri-component 0.2.2 | query-string do Router; entrada malformada pode consumir CPU | Mitigacao nativa adicionada; dependencia continua vulneravel |
| uuid antigo via xcode | Ferramentas de projeto iOS | Patch exige revisar compatibilidade do consumidor |

A entrada nativa +native-intent rejeita caminhos >4096 caracteres e codificacao
percentual invalida usando o decodificador nativo antes do Router.
Nao elimina o pacote vulneravel nem protege toda entrada web ou todo consumidor.
decode-uri-component 0.5.0 e ESM; substituir a dependencia CommonJS do query-string
7 por override pode quebrar navegacao. Nenhum override dessa natureza foi aplicado.

Nao execute npm audit fix --force: as sugestoes incluem SDKs anteriores e versoes
incompativeis. Manter Metro restrito ao desenvolvimento e a redes confiaveis;
acompanhar patches oficiais e repetir auditoria antes de producao.

Fontes primarias:

- [braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
- [node-forge](https://github.com/advisories/GHSA-86w9-cpqp-85rv)
- [decode-uri-component](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr)
- [uuid](https://github.com/advisories/GHSA-w5hq-g745-h8pq)

## Controles mantidos e exercitados

Sessao segura nativa, tokens capturados por conta, RLS, RPCs de XP, fila offline
idempotente e isolamento de caches. A exclusao exige JWT e senha da mesma identidade;
nao aceita um UUID de terceiro pelo corpo. Chaves administrativas ficam no servidor.
Suporte/diagnosticos nao recebem segredos ou respostas.

Os testes locais cobrem esses contratos; nao comprovam configuracao do ambiente
Supabase real, seguranca de todos os fornecedores ou ausencia de outras falhas.

O manifesto real do AAB 0.2.0 nao acrescentou permissoes em relacao a 0.1.0 e nao
contem AD_ID, localizacao ou microfone. Permanecem permissoes herdadas como
armazenamento externo, overlay, biometria e wake lock; revisar a necessidade de
cada uma e compatibilidade dos modulos antes de bloquear em uma versao futura.
Nao tratar ausencia de permissao GPS como prova sobre geolocalizacao por IP.

## Ensaio local de restauracao

tests/backupRestore.test.ts cria PostgreSQL isolado com as migrations, duas contas
ficticias e uma conclusao. Exclui uma conta antes do snapshot, exporta dumpDataDir
e inicializa outro PGlite com o arquivo. Confere:

- Recibo, XP 35 e 1.000 exercicios preservados.
- Repeticao da tentativa devolve o recibo sem acrescentar XP.
- A conta excluida antes do snapshot nao volta.
- Acesso anonimo negado e isolamento da conta pelo RLS mantido.

Nenhum dado real foi exportado e nenhum banco remoto foi restaurado.
Esse ensaio NAO cobre exclusoes ocorridas depois de um backup antigo.
Uma restauracao real precisa reconciliar essas exclusoes antes de liberar acesso.

## Operacao remota ainda pendente

1. Confirmar com o proprietario o plano, retencao, destino protegido e responsavel.
2. Produzir backup por ferramenta oficial com credenciais administrativas fora
   do app, do repositorio e do chat; criptografar e restringir o acesso.
3. Testar restauracao em projeto separado, sem enviar e-mails nem abrir acesso publico.
4. Conferir migrations, RLS, recibos, XP, progresso, identidades e objetos Storage.
5. Reconciliar pedidos de exclusao posteriores ao backup antes de qualquer reabertura.
6. Documentar resultado e prazo real de retencao; descartar copias conforme esse prazo.
7. So restaurar producao com autorizacao especifica, janela de indisponibilidade
   e plano de rollback. Esta entrega nao concede essa autorizacao.

Backup de banco nao inclui os objetos do Storage. Disponibilidade/retencao de
backups depende do plano; nao foi ativado plano pago, PITR ou backup remoto.
Consultar a [documentacao oficial do Supabase](https://supabase.com/docs/guides/platform/backups).

## Inventario de assets

- Sons WAV: sinais originais sintetizados; assets/sounds/README.md registra a origem.
- Nunito: SIL Open Font License 1.1, arquivo LICENSE_FONT no pacote instalado;
  preservar a licenca ao redistribuir a fonte.
- Avatares, mascote e redesign: geracoes registradas nos READMEs dos assets.
- Imagem de trilha e referencias fornecidas: direitos de uso dependem da origem
  informada pelo proprietario, ainda nao comprovada. Nao certificar como liberadas.
- Licencas de bibliotecas continuam nos pacotes originais. Este inventario nao
  substitui revisar obrigacoes de redistribuicao e manter os avisos aplicaveis.
