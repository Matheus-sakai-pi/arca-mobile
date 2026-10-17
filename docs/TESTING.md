# Testes automatizados

Requisito: Node.js 24 e dependencias do projeto instaladas (`npm ci`).

## Comandos

| Comando | Verificacao |
| --- | --- |
| `npm run test:unit` | Regras, validacao, decodificadores, persistencia e regressoes locais |
| `npm run test:integration` | Stores, sincronizacao, migracoes, RPCs e permissoes PostgreSQL |
| `npm test` | Todas as verificacoes unitarias e de integracao |
| `npm run test:e2e:install` | Instala o Chromium usado pelo Playwright |
| `npm run test:e2e` | Jornadas no navegador em 320, 390 e 1280 px |
| `npm run test:e2e -- --project=mobile` | Somente viewport de 390 px |
| `npm run test:e2e:ui` | Interface interativa do Playwright |
| `npm run test:report` | Abre o ultimo relatorio HTML |
| `npm run typecheck:tests` | Verifica os tipos dos novos testes e fixtures |
| `npm run check` | Lint, tipos do app/testes e todas as suites |

## Organizacao

- `tests/*.test.ts`: regressoes anteriores, preservadas sem mover arquivos.
- `tests/unit/`: novos testes isolados de regras e contratos.
- `tests/integration/`: integracoes novas entre stores reais e banco real.
- `tests/helpers/database.ts`: PostgreSQL temporario PGlite e todas as migracoes em ordem.
- `tests/e2e/`: Playwright Test, fixtures de sessao e adaptador de rede para o banco temporario.
- `scripts/run-tests.mjs`: selecao das suites Node, incluindo os testes antigos. Arquivos historicos que misturam testes isolados e banco ficam na suite de integracao. Duas tarefas simultaneas limitam o consumo de memoria.

## Jornadas Playwright

1. Entrada publica pelo onboarding, modo visitante, lição completa, erro e revisao, persistencia apos recarregar e revisao sem XP adicional.
2. Conclusao autenticada gravada no PostgreSQL, XP unico e restauracao da tela de resultado.
3. Convite de lembrete somente apos tres licoes, recusa persistente e abertura das configuracoes sem ativacao automatica.
4. Busca de usuario, pedido de amizade sem aceite automatico, aceite, desafio de dez perguntas, retomada apos recarregar e reenvio idempotente quando a resposta se perde depois da gravacao.
5. Relato com validacao, comentario preservado na falha, reenvio sem duplicacao e resposta da licao mantida.
6. Ranking total, semanal e entre amigos; falha e recuperacao; imagens carregadas e numeros sem sobreposicao.
7. Visitante nao envia relatos nem cria desafios.

Cada cenario roda em tres tamanhos de tela. Capturas de sucesso ficam anexadas ao
relatorio; falhas preservam screenshot, video e trace em `test-results/`.
Erros nao tratados do navegador e chamadas de rede inesperadas fazem o teste falhar.

## Isolamento e limites

O Playwright inicia e encerra seu proprio Expo na porta **8091**. Nao usa a porta
8086 da previa e recusa uma porta de teste ja ocupada. Nao e necessario iniciar
um servidor manualmente. `EXPO_NO_DOTENV=1` e valores publicos ficticios impedem
carregar credenciais de producao; trafego externo e bloqueado pelo navegador.

Cada worker usa um banco PGlite em memoria, com roles `anon` e `authenticated`,
`auth.uid()` de teste e as migracoes reais. Os RPCs rodam com o papel do usuario,
preservando as verificacoes de RLS e as regras de pontuacao. As contas sao
temporarias e removidas entre testes. Nenhuma consulta e enviada ao Supabase real.

O adaptador de teste substitui o transporte HTTP/PostgREST e a emissao de tokens
do Supabase Auth, nao as regras SQL do app. Isso nao valida o servico Auth real,
entrega de emails, configuracao remota, Edge Functions implantadas, dispositivos
Android/iOS, notificacoes nativas ou o painel administrativo separado. Esses
pontos ainda precisam de testes de homologacao e verificacao no aparelho.

Os scripts antigos `scripts/*-qa.mjs` continuam disponiveis como ferramentas
pontuais; nao sao executados automaticamente pela nova suite.

Base da configuracao: [Playwright Test](https://playwright.dev/docs/intro),
[fixtures](https://playwright.dev/docs/test-fixtures) e
[servidor local](https://playwright.dev/docs/test-webserver).
