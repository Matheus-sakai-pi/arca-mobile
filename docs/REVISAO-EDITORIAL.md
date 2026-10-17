# Revisão editorial do currículo — 18/10/2026

Leitura completa dos 1.002 itens das 10 unidades (1.000 exercícios e 2 leituras): enunciado,
alternativas, resposta correta e explicação, comparando com o texto bíblico citado.

## Resultado

- **Nenhum erro factual ou de resposta encontrado.** Personagens, lugares, sequências e
  referências conferem com as passagens citadas (ex.: Gênesis 1:5, Juízes 7, 1 Reis 17–18,
  Daniel 3 e 6, Lucas 10 e 15, Atos 27–28).
- A linguagem é neutra e descritiva ("segundo a narrativa", "Lucas situa"), sem afirmações
  doutrinárias controversas.
- As respostas corretas de todos os itens permanecem idênticas após as correções.

## Correções aplicadas

| Item | Antes | Depois |
|---|---|---|
| Lição "José reencontra sua família" (4 itens) | Benjamin | **Benjamim** (grafia em português) |
| `exodo-pascoa-1-v2` | Qual acontecimento a Páscoa de Êxodo está ligada a recordar? | A Páscoa de Êxodo recorda qual acontecimento? |
| Lição "Poemas do livro de Salmos" (3 itens) | Salmo 100: Ações de graças | Salmo 100: **Ação de graças** |
| `cartas-filipenses-5-v2` (explicação) | com ações de graças | com ação de graças |
| 100 perguntas de associação (modelo `*-6-practice-v3`) | Qual elemento corresponde a esta descrição: Pai de Isaque? | Qual destas opções corresponde a “Pai de Isaque”? |

Total: 108 perguntas com texto atualizado. No banco, a migration
`supabase/migrations/202610180003_editorial_review.sql` aplica as mesmas mudanças sem alterar IDs,
respostas, XP ou progresso. O teste `tests/integration/contentSync.test.ts` garante que o banco e o
app continuem com o mesmo conteúdo.

## Observações para próximas versões (não alteradas)

- **Repetição:** em cada lição, os 5 exercícios complementares (`practice-v3`) reaproveitam as
  mesmas três associações em formatos diferentes. Reforça a memória, mas pode soar repetitivo.
- **Distratores fáceis demais:** várias alternativas erradas são absurdas (ex.: "Golias", "O faraó",
  "Uma torre de açúcar"), o que deixa as perguntas muito fáceis para adultos.
- **Referências genéricas:** as explicações dos exercícios complementares repetem todas as
  referências da lição, mesmo quando só uma se aplica.
- **Sequências triviais:** algumas sequências só ordenam números de capítulo (ex.: Salmo 23 → 100 → 150).
