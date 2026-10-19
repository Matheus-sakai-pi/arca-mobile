# Design plano (estilo flat)

Remodelação de 19/10/2026, inspirada nos princípios do Duolingo com as cores e o mascote do Arca:

- Fundo branco liso nas abas; o cenário ilustrado continua disponível no componente `Screen` (prop `scene`) para momentos especiais.
- Botões, cartões, abas do ranking e botões redondos "gordinhos": borda de 2px e base mais grossa embaixo (`surfaces.card` e `surfaces.tactile` em `src/constants/surfaces.ts`).
- Ícones planos próprios em `src/components/icons/index.tsx` (mesmos nomes de antes). Ilustrados têm cores próprias; sobre fundo colorido viram silhueta branca.
- Medalhas de conquista planas (`AchievementIcon`), bateria e fogo da sequência planos.
- Seis abas só com ícones: Início, Aprender, Ranking, Amigos, Conquistas e Perfil. Amigos e Conquistas saíram do Perfil.
- Títulos maiores e menos texto nas telas principais.

Prints com dados de teste em `artifacts/redesign-flat/`.

## Como voltar ao design anterior

O design anterior está guardado no GitHub como tag `design-antes-do-flat` e branch `backup/design-antes-do-flat`.

- Para ver o design antigo: `git checkout design-antes-do-flat`.
- Para desfazer só a remodelação mantendo o resto: `git revert <commit da remodelação>`.
