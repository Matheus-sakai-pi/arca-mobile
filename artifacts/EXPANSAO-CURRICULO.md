# Expansão do currículo do Arca

## Entrega

- 10 unidades de 10 lições: 100 lições reais, 500 exercícios avaliativos.
- 92 lições e 460 exercícios acrescentados. As oito lições existentes mantêm IDs, conteúdo, perguntas e unidades.
- Dois cartões de leitura anteriores continuam adicionais, sem acertos ou XP.
- Cinco tipos distintos por lição; novos exercícios alternam múltipla escolha, lacuna, associação, ordenação, sequência, antes/depois e verdadeiro/falso. Os 16 formatos da engine continuam disponíveis.
- Conteúdo básico com explicações e referências, sem quantidades de livros vinculadas a um cânon ou interpretações controversas de profecias. Redação própria, não reprodução de uma tradução inteira.
- Mesmas moedas, avatares, mascote, fundo monocromático, sons, haptics, XP, streak, resultado e rotas.
- Aprender mantém a jornada em zigue-zague. Cabeçalhos expandem/recolhem unidades; a atual abre por padrão, evitando montar os 100 nós simultaneamente no primeiro carregamento.

O catálogo com todos os títulos está em [CURRICULO-100-LICOES.md](CURRICULO-100-LICOES.md).

## Arquivos principais

- src/data/lessons.ts: agrega o currículo e conserva os currículos anteriores.
- src/data/curriculumBuilder.ts: monta exercícios tipados, com alternativas rotacionadas e respostas explícitas.
- src/data/curriculumFoundations.ts: seis lições adicionais para cada unidade existente.
- src/data/curriculumOldTestament.ts: quatro unidades com dez lições cada.
- src/data/curriculumNewTestament.ts: quatro unidades com dez lições cada.
- src/lib/learningProgress.ts: valida conclusões históricas e sua continuação no currículo ampliado.
- src/app/(tabs)/learn.tsx: expansão/recolhimento das unidades, mantendo trilha e estados.
- scripts/generate-seed.ts: gera seed, catálogo e somente a nova migration de expansão.
- supabase/templates/expanded-curriculum.sql, supabase/migrations/202610080001_expanded_curriculum.sql e supabase/seed.sql: conteúdo remoto e compatibilidade de progresso/importação.
- tests/learning.test.ts, tests/database.test.ts, tests/curriculumExpansion.test.ts, tests/journey.test.ts e tests/rewards.test.ts: testes de conteúdo, sequência, migração e conquistas.
- tests/ui/CurriculumPreview.tsx: fixture isolada para conferência visual; não é rota pública do aplicativo.
- README.md e supabase/README.md: documentação e atualização do backend.

## Preservação do progresso

Não houve limpeza nem troca das chaves de armazenamento. Visitante continua em arca.learning.v1; cada conta mantém seu cache separado. Um prefixo legítimo das cinco ou oito lições anteriores continua válido, mesmo quando novas lições criam lacunas na sequência. As próximas conclusões precisam seguir a primeira lacuna. IDs desconhecidos, duplicados e saltos arbitrários continuam rejeitados.

Continuar aponta para a primeira lição não concluída do currículo ampliado. Lições antigas concluídas continuam acessíveis para revisão e não concedem XP novamente. A expansão não concede conclusões, XP ou streak automaticamente.

No servidor, courses.curriculum_expanded_at marca a data da expansão uma vez. Contas anteriores conseguem reenviar a sequência antiga respondida offline, exigindo todos os predecessores antigos e sem duplicar recompensas. Novas contas seguem a ordem completa. O banco conserva perguntas históricas, recibos, eventos de XP, perfis e avatares. Não há desativação de RLS nem permissões novas de escrita pelo cliente.

## Atualizar o Supabase

Esta entrega não executou alterações no projeto remoto. Visitante já usa as 100 lições locais; contas carregam o currículo publicado no seu Supabase.

Se as seis migrations anteriores já estão aplicadas, execute somente **supabase/migrations/202610080001_expanded_curriculum.sql** no SQL Editor. Ela inclui conteúdo e funções em uma transação. Não execute o seed isoladamente como substituto da migration, não reaplique migrations antigas e não use db reset.

Em banco novo, aplique as sete migrations em ordem, conforme supabase/README.md. Depois feche e reabra o app com conexão para atualizar o cache da conta. Uma conta offline conserva o conteúdo que já tinha em cache até recarregar online.

## Verificações

- TypeScript e lint sem erros.
- 137 testes automatizados, incluindo os 500 exercícios, 100 conclusões sequenciais com persistência, versões antigas de progresso, importação mista antigo/novo, offline, recibos, segurança, som e conquistas.
- PostgreSQL real em PGlite: sete migrations, seed repetível, acertos e erros nas 100 lições, XP máximo de 2.500 somente por primeiras conclusões perfeitas.
- Migration aplicada em banco de teste já contendo contas, XP, streak, avatares e oito lições: dados e recibos preservados; tentativa antiga pendente e revisão continuam funcionando.
- Prévia em 320x640: dez unidades, cabeçalhos expandir/recolher, primeira e última trilhas e clique bloqueado. Textos longos dos sete formatos novos testados por fixture, com seleção real, verificação e feedback.
- Na prévia existente, 55 XP e três conclusões permaneceram intactos após navegação/recarregamento. Nenhuma conclusão de teste foi adicionada a esse progresso.
- Bundle Android exportado com sucesso. Não houve teste em Android físico nesta sessão; a exportação não substitui esse teste.
- A rota temporária de inspeção foi removida. A fixture fica apenas em tests/ui.

Registro da prévia pequena: [screenshots/curriculum-320.png](screenshots/curriculum-320.png).

## Teste manual

1. Reabra o Expo Go na versão atualizada. Não limpe o armazenamento. Compare XP, avatares e conclusões existentes.
2. Em Aprender, abra/recolha cabeçalhos. Cada unidade deve ter dez lições e indicar cinquenta exercícios. A atual vem aberta; outras podem ser inspecionadas sem liberar lições.
3. Toque numa bloqueada, inclusive a última da unidade 10: deve mostrar o requisito, sem navegar. Role até a mensagem para conferir que cabe acima da navegação.
4. Use Continuar no Início ou na trilha. Responda à próxima disponível, misturando acertos e erros; confira lacunas, três pares, eventos/sequências, explicações, sons e haptics.
5. Confira a fórmula de XP, volte à trilha e verifique a conclusão/liberação. Dez conclusões numa unidade nova liberam a seguinte.
6. Revise uma concluída: +0 XP. Feche e reabra para conferir persistência.
7. Para contas, aplique a migration e reabra online. Depois teste uma conclusão offline, reabertura e sincronização: uma única recompensa e fila esvaziada.

Prévia local: http://localhost:8084/learn. Para iniciar novamente: npx expo start --go --web --port 8084. O telefone deve estar na mesma rede e usar o QR code/endereço de rede do Expo, não localhost.
