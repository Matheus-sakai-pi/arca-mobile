# Trilha cartoon por unidade

- A rota `/unit/[id]` agora usa fundo branco, sem paisagem ou personagens.
- O topo preserva a marca Arca, sequencia, XP e bateria; o menu inferior permanece acessivel durante a rolagem.
- A trilha apresenta somente as licoes da unidade selecionada. A unidade seguinte fica na propria tela, acessivel pela lista Aprender. Cores, moedas, marcos e progresso continuam iguais.
- A paleta das dez unidades fica em `src/lib/trailAppearance.ts`. As moedas sao desenhadas com formas nativas: topo de cor lisa e lateral 26% mais escura. Os PNGs originais do usuario permanecem intactos.
- A moeda atual abre a licao e exibe o balao COMEÇAR. Nao existe botao adicional de continuar no rodape.
- O anel usa os exercicios dominados na tentativa salva e validada pelo StudyProvider, de acordo com a barra do jogador. Selecionar uma resposta sem confirma-la nao avanca o anel. Tentativas de outra versao da licao sao ignoradas. Nenhuma porcentagem de exemplo e gravada no progresso real.
- O bau intermediario fica cinza e fechado antes de completar metade das licoes. Depois pode ser aberto para receber 5 a 7 energias, uma vez por carteira e unidade, com sorteio e conclusoes conferidos no servidor. O trofeu continua visual: cinza antes de concluir a unidade e dourado depois.
- As regras de bloqueio, revisao, XP e energia nao foram alteradas. As animacoes de conclusao continuam finitas e respeitam movimento reduzido.
- As capturas automatizadas usam contas e banco de testes isolados. Nenhum historico real foi preenchido para produzir as demonstracoes.

Somente previa web nesta entrega, sem gerar ou enviar outro AAB.

## Verificacao inicial do redesenho

- 206 testes unitarios aprovados, incluindo cores, laterais escuras, contraste AA dos dez banners e percentual restaurado.
- Tipos do aplicativo e dos testes, alem da verificacao de estilo, aprovados.
- Oito cenarios de interface verificados em tres tamanhos de tela: bloqueios, inicio pela moeda, navegacao, pausa e retomada, anel de 40%, marcos reais e transicao entre unidades. A execucao principal aprovou 23 casos; o primeiro excedeu o tempo na compilacao inicial do servidor e passou ao ser repetido isoladamente.
- A captura historica `artifacts/screenshots/clean-trail/transicao-azul-verde-9x16.png` mostra o desenho anterior com duas unidades juntas. Esse comportamento foi removido a pedido do usuario.
- Previa principal reiniciada em `http://localhost:8089`, com resposta HTTP 200. Nao houve teste em aparelho Android fisico nesta etapa.

## Ajuste para uma unidade por tela

- Removida a unidade seguinte da rota, preservando cores, moedas, marcos e progresso.
- Quatro testes unitarios e seis testes de interface aprovados. Os testes de interface conferem unidades 1, 2 e 10 em tres tamanhos de tela, incluindo ausencia de licoes de outras unidades, recarregamento e desbloqueios originais.
- Verificacao de estilo e tipos do aplicativo e dos testes aprovadas. Previa em 8089 respondendo com HTTP 200. Nenhum novo AAB gerado.

## Recompensa do bau

- Regras em `CHEST_ENERGY_CONFIG`, no mesmo arquivo da bateria. A bateria cheia nao consome o bau; saldo parcial e eventual excedente sao informados antes do resgate.
- Migration adicional `202610170003_unit_chest_energy.sql`; arquivo separado para SQL Editor em `artifacts/battery/ativar-baus.sql`. Nao reaplicar a migracao original da bateria em um banco ja atualizado.
- O usuario informou que aplicou o SQL. Uma consulta sem sessao/carteira confirmou que a acao nova esta instalada no servidor: ela exige a identidade de visitante, em vez de rejeitar a acao como desconhecida. Nenhuma conta real foi alterada por essa verificacao.
- Validacao: 208 testes unitarios, seis cenarios de banco (quatro de regressao da bateria e dois do bau) e 21 testes Playwright aprovados; estilo e tipos do app/testes aprovados. A previa principal respondeu HTTP 200. Os cenarios cobrem bateria cheia, limite parcial, resposta perdida, tentativa duplicada, recarregamento, isolamento de contas/visitantes e servidor ainda nao atualizado. Nenhum AAB gerado.
