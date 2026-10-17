# Verificação da integração Supabase

## Executado

- TypeScript estrito: sem erros.
- ESLint com max-warnings=0: sem erros ou warnings relevantes.
- 83 testes automatizados passaram (incluindo os 63 testes anteriores).
- As três migrations e o seed foram executados em PostgreSQL real via PGlite, sem serviços remotos.
- Seed executado duas vezes: mesmos IDs, sem duplicar conteúdo.
- Os 25 exercícios atuais foram comparados com o seed gerado; conteúdo preservado.
- Perfis automáticos, RLS com roles anon/authenticated, bloqueio de escrita indevida e leitura de outros usuários.
- Oito formatos no contrato/servidor; content_card não infla pontuação.
- Conclusão/retry/revisão, XP sem duplicação, desbloqueio e recibos.
- Importação de 118 XP / cinco lições, repetição idempotente, sobreposição, origem em outra conta e limites inválidos.
- Streak testado com datas fixas somente na instância de teste: dias consecutivos, dois acessos no mesmo dia, intervalo e maior sequência. Produção usa data UTC do backend.
- Fila offline: reabertura, replay, perda de resposta depois do commit remoto, falha de disco e quarentena.
- Conta nova offline não herda outra conta. Operação antiga não usa o token da próxima conta.
- Cache corrompido preservado até recuperação remota e backup; dados de visitante não são removidos.
- Expo install --check: dependências compatíveis pelo mapa local do SDK. A checagem de versões na rede estava indisponível.
- Exportação Android com bytecode Hermes concluída em dist/supabase-android. O primeiro intento falhou por permissão na pasta temporária do ambiente; o segundo passou com TEMP/TMP em .cache/export-tmp, sem alterar a engine Hermes ou configuração do app.

## Prévia local, 360 x 800

- Servidor Expo Go/web ativo em http://localhost:8083.
- Sem credenciais: login informa indisponibilidade real de contas, sem simular autenticação.
- Continuar sem conta abre Home.
- Progresso original permaneceu em 118 XP e 5/5 concluídas; recarregar recuperou diretamente o modo visitante e os mesmos valores.
- Perfil exibe Salve seu progresso e abre cadastro. Cadastro vazio mostra validação de nome/email/senha.
- Origem isolada 127.0.0.1 mantinha 18 XP e 1/5 concluídas. Uma revisão dos cinco formatos mostrou erro, acerto, lacuna, associação, ordenação, pistas, 4/5, 80%, +0 XP e retorno à trilha; total permaneceu 18 XP.
- Imagem da jornada e trilha responsiva foram preservadas. A aba Aprender não foi transformada em lista.

Imagens: supabase-guest-profile.jpg, supabase-local-review.jpg e supabase-preserved-journey.jpg nesta pasta.

## Arquivos principais desta etapa

- supabase/migrations/202610060001_learning_schema.sql e 202610060002_learning_functions.sql, seed.sql e README.md. A migration anterior de identidade foi preservada.
- scripts/generate-seed.ts, package.json/package-lock.json (PGlite somente desenvolvimento e comando de seed), .env.example e .gitignore (.cache temporário).
- src/types/backend.ts, profile.ts e learning.ts.
- src/lib/supabase.ts, accountToken.ts, accountLearningStore.ts, backendDecoders.ts, backendErrors.ts, learningProgress.ts, lessonEngine.ts e questionEngine.ts.
- src/services/learning.ts e providers/LearningProvider.tsx/AuthProvider.tsx.
- SyncNotice, LearningGate, ContentCardQuestion, QuestionRenderer, LessonPlayer e consumidores de unidade/progresso (Home, Aprender, Perfil, trilhas e rotas de lição/resultado).
- AuthForm e layout raiz para texto do modo visitante/loading de sessão.
- tests/accountLearning.test.ts e tests/database.test.ts.
- README e este relatório. Assets existentes, dados de src/data/lessons.ts, sons e seu controlador não foram substituídos.

## Não verificado remotamente

O usuário informou que ainda não possui projeto Supabase. Nenhum projeto, chave secreta, senha, usuário remoto ou serviço foi criado. PGlite usa uma tabela auth.users e auth.uid de teste; não é o serviço Supabase Auth e não valida seus emails ou API REST.

Cadastro, confirmação de email, login/logout, recuperação da sessão real após fechar Expo Go, atualização em outro aparelho e importação pelo Supabase hospedado precisam do roteiro em supabase/README.md após configurar o projeto.

Não houve acesso a Android físico nesta etapa. Exportar o bundle confirma empacotamento Android, não audição dos efeitos, haptics, botão voltar ou ciclo de vida real do aparelho. Esses testes estão descritos no guia.

## Limitações intencionais

- Uma unidade inicial; tabelas comportam cursos adicionais, mas não foi criado seletor de curso novo.
- Visitante usa dados locais originais; conta usa conteúdo do servidor com cache/fallback.
- Importação única por conta/origem. Legado não tem respostas/histórico por lição: limites são validados, mas não há prova antifraude da pontuação antiga.
- Conclusões offline ganham data de atividade quando o backend confirma. Nenhum dia passado é inventado a partir do celular.
- Tentativas ainda não concluídas continuam em memória; fechar no meio reinicia.
- Ranking indisponível e mascote com pose existente. Nenhum pagamento, push, IA, grupo, chat ou multiplayer.
- Alertas transitivos existentes do npm não foram corrigidos com upgrades incompatíveis do Expo.
