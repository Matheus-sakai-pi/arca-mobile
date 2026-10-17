# Próximos passos (feitos pelo dono do projeto)

Guia simples do que precisa da sua conta ou do seu celular. Atualizado em 18/10/2026.

## 1. Atualizar o banco de dados (Supabase)

As melhorias de bateria (30), conquistas na nuvem e revisão editorial só valem depois disso.

1. Entre em [supabase.com](https://supabase.com), abra o projeto **Arca** e clique em **SQL Editor**.
2. Clique em **New query**, abra o arquivo `artifacts/supabase-2026-10-18/1-ativar-bateria-30.sql`,
   copie todo o conteúdo, cole e clique em **Run**.
   - Se aparecer erro dizendo que algo "already exists", a bateria nova já estava ativa: nesse caso,
     rode apenas o arquivo `supabase/migrations/202610180001_battery_capacity_30.sql`.
3. Faça o mesmo com `artifacts/supabase-2026-10-18/2-ativar-melhorias.sql`.
4. Aplique uma vez só. Os arquivos não apagam progresso, XP nem contas.

Importante: a bateria nova exige a versão nova do app. Aplique o passo 1 junto com a publicação do
próximo AAB (versionCode 7), não antes.

## 2. Gerar e testar a nova versão no Android

1. Gere o novo AAB (versionCode 7) pelo EAS e envie para o **teste interno** da Play Store.
2. Instale pela loja num celular Android e confira:
   - login, cadastro e recuperação de senha;
   - uma lição completa: som, vibração, botão voltar e a dica da bateria (aparece uma vez);
   - bateria mostrando "de 30" e recarga de 1 a cada 48 min;
   - ranking como visitante (convite para criar conta) e com conta;
   - trocar uma preferência (ex.: meta diária), entrar em outro aparelho e ver se ela acompanha;
   - excluir uma conta de teste.

## 3. Cópia de segurança do banco

1. No Supabase, abra **Database → Backups** e confira o que o seu plano oferece.
2. Se o plano não tiver backup automático para baixar, faça uma cópia manual periodicamente
   (por exemplo, toda semana) e guarde fora do computador.

## 4. Republicar a página de privacidade

O texto foi atualizado (conquistas e preferências agora ficam na conta).

1. A página nova já está gerada na pasta `legal-site/dist`.
2. Entre no [Netlify](https://app.netlify.com), abra o site **arca-politica**, vá em **Deploys** e
   arraste a pasta `legal-site/dist` para a área de upload.

## 5. Alerta de travamentos (opcional, recomendado antes de abrir para todos)

Serve para você saber quando o app fecha sozinho no celular de alguém, com o motivo.

1. Crie uma conta gratuita em [sentry.io](https://sentry.io) e um projeto do tipo **React Native**.
2. Copie o **DSN** que o Sentry mostra (um endereço que começa com `https://`).
3. Envie o DSN para o Claude: a integração é instalada no app e entra no próximo AAB.
4. A política de privacidade precisa citar o Sentry como serviço de diagnóstico; isso é ajustado junto.
