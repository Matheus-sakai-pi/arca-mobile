# Fotos VIP com aprovacao manual

## Estado e ativacao

O app e o painel separado incluem o fluxo de envio e moderacao. A ativacao real ainda depende da migration e das funcoes no projeto Supabase. Os testes usam apenas banco e armazenamento simulados locais; nao enviam fotos a producao.

1. No SQL Editor do Supabase, execute uma unica vez `artifacts/membership/ativar-fotos-perfil.sql` (copia exata da migration `202610180008_profile_photos.sql`). As migrations anteriores precisam estar aplicadas. O bucket `profile-photos` permanece privado; nao torne o bucket publico.
2. Publique a nova Edge Function `profile-photo`, com verificacao JWT da plataforma desligada: o handler autentica explicitamente cada token com `auth.getUser`. O arquivo unico para o editor do Supabase esta em `artifacts/membership/profile-photo.function.ts`. As variaveis padrao `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` ficam apenas no servidor; nao adicione uma chave de servico ao app ou painel.
3. Atualize a funcao existente `delete-account`, preservando seu nome e verificacao JWT, com `artifacts/delete-account.function.ts`. A nova versao elimina os arquivos de fotos antes de excluir a conta. Aplique o SQL antes de publicar esta funcao.
4. Republique a politica publica a partir de `legal-site/dist/` antes de liberar o recurso. A politica dentro do app tambem foi atualizada.
5. Gere uma nova compilacao Android antes de distribuir: o seletor e o preparador de imagens adicionam modulos nativos. Um AAB anterior nao inclui este recurso.

Alternativa via CLI autenticada do Supabase, a partir de `arca-mobile` e com o projeto correto vinculado:

```text
npx supabase functions deploy profile-photo --no-verify-jwt
npx supabase functions deploy delete-account
```

Nao execute novamente a instalacao completa de VIP para ativar fotos. A nova migration nao concede VIP a nenhuma conta nem altera XP, energia ou planos Play.

## Fluxo

- No Perfil, **Foto de perfil** abre envio, status e lista de usuarios bloqueados. Somente VIP ativo pode enviar; dias de energia de convites nao contam como VIP.
- O usuario escolhe uma imagem, confirma o recorte e aceita as regras. Na web, o recorte e quadrado e central; no Android/iOS, o seletor tambem oferece recorte. O app reduz a imagem para 512 x 512, JPEG, ate 384 KiB.
- O servidor autentica o titular, limita a cinco tentativas em 24 horas e a um envio pendente, decodifica o JPEG com limites de memoria e resolucao e o reencoda a partir dos pixels, removendo EXIF, comentarios e dados adicionais. SVG, GIF, video, JPEG invalido e imagens fora do limite nao sao publicados.
- O arquivo e privado e imutavel. Nao ha permissao de upload, alteracao ou exclusao direta para usuarios do app. Nao ha analise por IA nem email.
- No painel, **Fotos de perfil** mostra filas de pendentes, aprovadas, denunciadas, rejeitadas e removidas. Aprovar so fica habilitado apos carregar a imagem. Rejeitar/remover exige motivo; e possivel suspender ou permitir novos envios. Decisoes usam o horario/versao do registro para evitar sobrescrever uma decisao de outra sessao.
- Aprovacao troca o avatar publico. Nova foto exige nova aprovacao; a anterior permanece durante a analise e em caso de rejeicao. O app atualiza perfil/avatars periodicamente e ao conferir o status. Molduras VIP continuam funcionando com a foto.
- Fotos aprovadas aparecem em todos os lugares que usam o componente Avatar, incluindo ranking, amigos e desafios. Antes da aprovacao, nenhuma foto candidata e inserida nessas listas.
- Ao expirar o VIP, a foto personalizada deixa de ser exibida, mas o arquivo e a analise permanecem privados. Uma renovacao valida permite exibir a foto aprovada novamente, se ela continuar selecionada.

## Denuncia, bloqueio e exclusao

- Tocar na foto de outra pessoa abre denuncia e bloqueio. Bloquear oculta fotos entre as contas, remove a amizade e cancela desafios pendentes/em andamento. Novas amizades e desafios sao bloqueados no servidor. Nomes e XP podem permanecer em rankings gerais; isto nao e um recurso de anonimato.
- **Perfil > Foto de perfil > Usuarios bloqueados** permite desbloquear; amizades nao sao restauradas automaticamente.
- A administracao continua podendo analisar conteudo denunciado no painel mesmo entre contas bloqueadas. O app normal respeita o bloqueio tambem para a conta administradora.
- Links assinados expiram em 60 segundos. Um link ja entregue e uma capacidade temporaria: uma foto removida pode continuar acessivel por esse prazo. O app nao grava esses links nem as fotos remotas no cache de progresso ou em armazenamento persistente proprio. Copias feitas por terceiros nao podem ser apagadas remotamente.
- Pedidos, motivos e imagens rejeitadas/canceladas/removidas podem permanecer em area privada enquanto a conta existir, conforme a politica. A exclusao da conta congela novos envios, remove a pasta privada em lotes limitados e depois exclui o usuario. Uma falha nao devolve recibo de exclusao bem-sucedida e permite tentar novamente. Upload em andamento que perde o titular e abortado e tenta remover o arquivo.

## Verificacao

- `tests/unit/profilePhoto.test.ts`: contratos, formatos, limites, limpeza de metadados, autenticacao, consentimento, repeticao e exclusao da pasta.
- `tests/integration/profilePhoto.test.ts`: RLS inclusive diante de politicas amplas preexistentes, anonimo, protecao de fotos pendentes, moderacao, substituicao, restricao, quota, expiracao VIP, denuncias e bloqueios.
- `tests/e2e/profilePhoto.spec.ts`: selecao real pelo navegador, conversao JPEG, envio, painel separado, aprovacao/rejeicao/remocao, conta gratuita, erro recuperavel, denuncia, bloqueio e desbloqueio, em 320/390/1280 px.

Os pacotes preparados para o editor podem ser regenerados com `node --experimental-strip-types scripts/generate-photo-function.ts` e `node --experimental-strip-types scripts/generate-delete-function.ts`.
