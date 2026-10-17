# Nome publico unico

Implementado localmente em 15/10/2026. Nao aplicado ao Supabase de producao e nao
incluido no AAB existente.

## Comportamento

- Cadastro usa um unico campo Nome de usuario. Aceita @ opcional, normaliza
  maiusculas, exige de 3 a 30 letras ASCII minusculas, numeros ou underscore.
- A identidade publica persistida e username sem @ e display_name igual a
  @username. O segundo campo permanece apenas por compatibilidade com RPCs,
  caches e versoes anteriores: nao ha dois nomes editaveis na interface nova.
- Perfil, rankings e amigos mostram o mesmo nome. A busca aceita com ou sem @.
- Disponibilidade e verificada antes de cadastrar. Um trigger e indice unico
  protegem a confirmacao final contra nomes repetidos, inclusive com outra caixa.
  A verificacao de disponibilidade nao reserva o nome.
- Nenhum nome existente e modificado pela migration. Contas antigas recebem um
  aviso para escolher o nome, com Escolher depois, e podem concluir no Perfil.
  O aviso nao aparece durante licoes, recuperacao, telas legais ou modo offline.
- Ao escolher, os IDs permanecem identicos: XP, progresso, historico, avatar,
  sequencia e relacionamentos continuam vinculados a mesma conta.
- Nomes de contas antigas continuam visiveis como antes ate a escolha pelo dono.
  Clientes antigos ainda podem registrar contas com o fluxo anterior; o aviso
  aparecera quando abrirem uma versao nova. Atualizacoes de avatar nao renomeiam.

## Ativacao

1. No projeto Supabase correto, execute uma vez o conteudo completo de
   supabase/migrations/202610150002_public_username.sql no SQL Editor.
2. Amigos e ranking semanal continuam precisando da migration anterior
   202610150001_friends_weekly.sql, caso ainda nao tenha sido executada.
3. A nova migration cria a verificacao de disponibilidade e os triggers, sem
   atualizar automaticamente dados de contas existentes. Mantenha o backup habitual.
4. Teste um cadastro novo, uma tentativa com nome ocupado e a escolha numa conta
   antiga. Confirme o mesmo nome no Perfil, ranking e busca de amigos.
5. Atualize a publicacao da politica de privacidade e gere outro AAB somente
   quando a rodada atual de alteracoes estiver pronta.

Sem a migration, a interface informa que a escolha precisa ser habilitada no
servidor. O cadastro novo nao segue silenciosamente com um @ automatico.

## Verificacao local

- tests/username.test.ts: PostgreSQL local, provisionamento atomico, duplicatas,
  maiusculas, validacao, RLS, nomes antigos preservados e dados sem alteracao.
- tests/signup.test.ts: disponibilidade antes de Auth e metadata canonica;
  nenhuma confirmacao forcada, uso administrativo ou email real.
- scripts/username-qa.mjs: 320, 390, 430 e 1280 pixels; aviso, adiamento, edicao,
  erro de disponibilidade, colisao ao salvar, persistencia, ranking e busca.
- Validacao remota e no Android ainda pendente. Nenhum banco real foi alterado.
