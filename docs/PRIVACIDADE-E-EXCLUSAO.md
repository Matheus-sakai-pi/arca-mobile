# Privacidade e exclusao de conta

Responsavel informado: Matheus Sakai. Contato publico: matheussakai23032001@gmail.com.

Situacao atual: o proprietario publicou a funcao delete-account e as paginas em
https://arca-politica.netlify.app/ e https://arca-politica.netlify.app/excluir-conta.html.
Isso foi relatado no chat; nenhuma exclusao real foi executada nesta etapa.
O texto local atualizado para 0.2.0 ainda precisa ser republicado no mesmo site.

## O que esta implementado

- Politica de Privacidade no app, acessivel no Perfil, no cadastro/login e sem autenticar pela rota /privacy.
- Rota /account/delete com confirmacao de permanencia e senha atual. Visitantes recebem um caminho de solicitacao por e-mail, sem apagar progresso local.
- Edge Function delete-account: valida JWT via Supabase Auth, confere senha da mesma identidade e faz hard delete de auth.users pelo Admin API. A chave administrativa existe somente no servidor.
- As chaves estrangeiras existentes removem perfil, progresso, tentativas/respostas, XP, atividades e importacoes em cascata. Nao foi necessario mudar as tabelas ou criar uma migration de exclusao.
- Apos recibo confirmado, limpeza somente do cache/conquistas/backups, historico, rascunhos e preferencias locais da conta; visitante e outras contas nao sao apagados. Gravacoes antigas sao bloqueadas durante a exclusao. Uma limpeza parcial e exibida como tal e pode ser repetida sem excluir novamente no servidor.
- Paginas estaticas preparadas em legal-site/dist: politica completa em index.html e solicitacao de exclusao em excluir-conta.html. O formulario prepara um e-mail; nao afirma que o enviou automaticamente e nao precisa reinstalar o app.

## 1. Publicar a funcao no Supabase

Nao coloque chave service_role, sb_secret ou senha em .env do app, no site ou nesta conversa.

Opcao pelo painel:

1. Abra seu projeto Supabase > Edge Functions > Deploy a new function > Via Editor (os nomes podem variar).
2. Nomeie a funcao exatamente delete-account.
3. Use o conteudo completo de artifacts/delete-account.function.ts como codigo da funcao e publique. Esse arquivo combina index.ts e handler.ts para evitar imports locais no editor.
4. Mantenha Verify JWT habilitado. A funcao tambem verifica a identidade com auth.getUser; nao aceita userId ou e-mail fornecidos no corpo.
5. SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY sao variaveis do ambiente das Edge Functions hospedadas. Nao envie a chave administrativa ao cliente.

Alternativa pela CLI, na pasta arca-mobile:

```sh
npx supabase login
npx supabase functions deploy delete-account --project-ref kuawynauynlyieocaahr
```

Essa publicacao nao aconteceu automaticamente nesta implementacao. Ela requer sua conta Supabase autenticada. Se houver erro de segredo ausente ou autenticacao, revise a configuracao no painel; nao desative verificacoes de identidade para contornar o erro. Documentacao: https://supabase.com/docs/guides/functions/deploy e https://supabase.com/docs/guides/functions/auth.

## 2. Publicar as paginas externas

As paginas funcionam como HTML/CSS/JS estaticos, sem banco, senha, rastreamento ou chave Supabase.

Uma opcao e o publicador manual do Netlify: https://app.netlify.com/drop. Entre na sua conta e envie apenas a pasta legal-site/dist, nao a pasta inteira do app. Confira que o projeto esta publico e mantenha o endereco estavel. Nao e necessario comprar um dominio para usar o endereco fornecido pela hospedagem. Instrucao oficial: https://docs.netlify.com/deploy/create-deploys/.

Depois de publicar, os enderecos serao equivalentes a:

```text
https://SEU-SITE.netlify.app/
https://SEU-SITE.netlify.app/excluir-conta.html
```

Verifique ambos sem login, inclusive em aba anonima e no celular. Use o primeiro como URL da Politica de Privacidade no Play Console e o segundo como URL de exclusao de conta. Nao use localhost, links privados, PDF ou arquivo local no Play Console.

Para atualizar o texto, altere src/constants/privacy.ts e rode:

```sh
node --experimental-strip-types scripts/generate-privacy-site.ts
```

Depois publique novamente a mesma pasta no mesmo site. O app usa o mesmo texto local, sem depender de carregar uma pagina externa.

## 3. Atendimento dos pedidos por e-mail

O endereco de suporte deve ser monitorado por Matheus Sakai. O formulario externo nao exclui automaticamente uma conta, nao envia e-mail pelo servidor e nao cria um ticket. O usuario precisa enviar a mensagem pelo proprio e-mail.

Confirme a titularidade antes de excluir; nao aceite simplesmente um UUID/e-mail de terceiro. Nunca solicite senha por e-mail. Oriente recuperacao de senha quando necessario. Depois da verificacao, a exclusao administrativa da pessoa correta em Authentication > Users deve ser definitiva, nao apenas bloqueio, e as mesmas cascatas removem os dados de aprendizado. Informe a conclusao ao solicitante. Nao restaure contas excluidas ao recuperar um backup.

A politica descreve logs e eventuais backups dos fornecedores sem inventar prazos. Antes da publicacao, confirme o plano e os prazos reais de logs/backups no Supabase, hospedagem e suporte; ajuste o texto se houver retencao adicional. A revisao juridica/editorial e as declaracoes de seguranca de dados/publico-alvo no Play Console continuam sob responsabilidade do desenvolvedor. Esta implementacao nao certifica conformidade legal nem muda automaticamente o publico-alvo do app.

## Teste manual seguro

Use exclusivamente uma conta de teste descartavel, nao sua conta principal.

1. Publique a Edge Function. Entre com uma conta de teste, conclua uma licao e confira XP e ranking.
2. Abra Perfil > Politica de Privacidade. Confira responsavel, contato e texto inteiro. Abra tambem a rota /privacy sem login.
3. Abra Excluir conta: o botao deve ficar desativado sem senha e sem a confirmacao. Cancele/volte: nada deve ser apagado.
4. Informe senha incorreta. Deve haver erro, sem apagar conta/progresso e sem revelar informacoes de outra pessoa.
5. Confirme com a senha correta. Confira a mensagem de exclusao, o fim da sessao e a impossibilidade de entrar de novo com as credenciais antigas.
6. No painel, confira que a conta, perfil e linhas de aprendizado sumiram; confira que a outra conta de teste e o curriculo permanecem. Atualize o ranking.
7. Feche e reabra o app. O cache, conquistas, rascunhos, historico e preferencias da conta excluida nao devem voltar. Dados independentes de visitante e outras contas devem permanecer.
8. Teste offline e falha de funcao: nao deve aparecer sucesso falso. Falha de limpeza local apos a exclusao confirmada deve mostrar aviso e permitir finalizar a limpeza.
9. Na pagina externa publicada, prepare um pedido com um e-mail de teste. Confira o destinatario/assunto, nao envie a mensagem durante um teste automatizado. O texto precisa deixar claro que o envio ainda depende de voce.

Os testes automatizados usam dependencias simuladas e PostgreSQL local; nenhuma conta real foi excluida. A publicacao remota, o envio de e-mail de suporte e o teste Android fisico nao sao comprovados por esses testes. Para distribuir o novo fluxo na Play Store, e necessario gerar e enviar outra versao .aab depois dessas validacoes.

Referencias de requisitos: https://support.google.com/googleplay/android-developer/answer/13327111?hl=pt-BR e https://support.google.com/googleplay/android-developer/answer/10144311?hl=pt-BR.

## Arquivos principais

- src/app/privacy.tsx, src/app/account/delete.tsx e src/app/account/deleted.tsx: telas novas.
- src/app/_layout.tsx, src/app/(tabs)/profile.tsx e src/components/auth/AuthForm.tsx: acessos e rotas publicas.
- src/constants/privacy.ts: texto e contato compartilhados entre app e paginas.
- src/services/accountDeletion.ts: chamada segura, recibo e limpeza local.
- src/lib/accountStorageGuard.ts e src/lib/accountStorage.ts: bloqueio de gravacoes e limpeza isolada por conta.
- src/providers/LearningProvider.tsx e src/providers/RewardMotionProvider.tsx: uso do armazenamento protegido.
- supabase/functions/delete-account/index.ts, handler.ts e supabase/config.toml: exclusao autenticada no servidor.
- scripts/generate-delete-function.ts e artifacts/delete-account.function.ts: arquivo unico para o editor Supabase.
- scripts/generate-privacy-site.ts, legal-site/site.css, legal-site/request.js e legal-site/dist: paginas externas.
- tests/accountDeletion.test.ts, tests/accountDeletionDatabase.test.ts e scripts/privacy-qa.mjs: testes.
- README.md, supabase/README.md, .easignore e eslint.config.js: documentacao e configuracao pontual.
