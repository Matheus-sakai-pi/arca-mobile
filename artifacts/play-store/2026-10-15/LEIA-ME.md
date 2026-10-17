# Materiais da Play Store: Arca

Preparados em 15/10/2026, em portugues do Brasil. Nao publicados automaticamente.

Saida: `artifacts/play-store/2026-10-15/`.

- `icone-512.png`: novo icone da loja com o velhinho do Arca sobre fundo azul, exportado em 512 x 512, PNG RGBA. Substitui o livro no pacote da loja. Nao altera o icone instalado do AAB anterior.
- `destaque-1024x500.png`: arte de destaque, PNG RGB sem transparencia, 1024 x 500.
- `capturas/`: oito capturas de 1080 x 1920, PNG RGB sem transparencia, na ordem numerada.
- `textos/`: nome, descricao curta, descricao completa, novidades e textos alternativos.
- `previa.html`: catalogo local dos materiais, com acesso aos arquivos.
- `visao-geral.jpg`: contato visual das oito capturas.
- `verificacao.json`: dimensoes, formatos, tamanhos e hashes conferidos.

## Origem e limites das capturas

Capturas da interface real da exportacao WEB DE PRODUCAO do codigo atual, em navegador isolado, sem barra de navegador, overlay de desenvolvimento, interface desenhada por IA ou montagem de recursos inexistentes. Viewport 432 x 768, escala 2,5, gerando 1080 x 1920 pixels. Sem moldura de telefone ou frases promocionais sobre a interface.

Todas as contas, nomes, relacionamentos, posicoes, XP e sessoes sao de demonstracao, com respostas da rede simuladas. As licoes e ilustracoes sao as do aplicativo. O progresso e calculado pelo mecanismo real local para manter lições e XP coerentes. Nenhuma conta foi criada ou alterada no Supabase. Nao se trata de depoimentos ou prova de participantes reais.

Estas imagens NAO sao capturas do Android instalado. Antes de envia-las a loja, compare as telas com o AAB instalado e substitua as que divergirem, especialmente fontes, margens, teclado e barra de navegacao. O ultimo titulo do Perfil ainda nao esta no AAB codigo 5. Nao sao materiais para tablet ou Android TV.

## Textos

Fonte editavel: `store/pt-BR/listing.json`. Limites conferidos: nome 30, descricao curta 80, descricao completa 4000, novidades 500 e textos alternativos 140 caracteres. Os arquivos TXT nao incluem marcadores de campo nem contagens. As novidades descrevem as mudancas recentes, sem prometer uma versao futura.

Nao anunciamos Biblia integral para leitura, ranking por cidade, chat, notificacoes, compras, recursos de IA ou sincronizacao de rascunhos e preferencias.

## Arte de destaque

Gerada com a ferramenta integrada image_gen, modo ads-marketing. Referencia: `assets/redesign/ark-landscape.png`, apenas para estilo e ambiente. A arte nao altera o fundo usado no app. O arquivo gerado original foi preservado; a saida da loja recebeu apenas redimensionamento/corte central e conversao para RGB no tamanho exigido.

Prompt: banner horizontal aproximadamente 2,048:1 para o app brasileiro Arca; estilo 3D ilustrado de livro de historias, ceu azul vivo, arca de madeira iluminada sobre colina verde a direita, vale e rio ao fundo; texto branco arredondado extranegrito "Arca" e abaixo "Aprenda a Bíblia", com sombra azul discreta; margem de seguranca de 10%; sem interface, telefone, selo de loja, avaliacoes, numeros, chamada de download ou texto adicional. Texto e arca inteiros e legiveis.

## Icone do velhinho sobre azul

Gerado com a ferramenta integrada image_gen, modo identity-preserve, a partir de `assets/mascot/idle.png`. Original final preservado em `store/pt-BR/icon-mascot-blue.png`. O mascote e seu rosto sao o foco; sem simbolo de livro, texto, borda ou cantos arredondados embutidos. A versao da loja recebeu somente redimensionamento para 512 x 512 e codificacao PNG RGBA, abaixo de 1024 KB.

Prompt: preservar a identidade do mascote idoso do Arca, com cabelo ondulado branco, barba e bigode brancos, olhos castanhos abertos, sorriso, pele quente, tunica clara e faixa vermelha. Retrato frontal centralizado de cabeca e ombros, reconhecivel em tamanho pequeno, cabelo e barba inteiros. Remover livro e mao acenando. Fundo azul royal #2E6BEF de ponta a ponta, sem cenario ou elementos extras. Imagem quadrada opaca, sem texto, outros personagens, moldura, cantos arredondados ou sombra externa.

## Reproduzir

1. `npx expo export --platform web --output-dir .cache/play-store-web`
2. `node scripts/prepare-store-listing.mjs CAMINHO_DA_ARTE_GERADA`
3. `node scripts/capture-store-listing.mjs`

Os scripts de arte/captura usam Playwright e sharp do runtime de documentos, via NODE_PATH. Nao acrescentam dependencias ao aplicativo.

## Aprovacao final

Conferir fidelidade Android, direitos dos assets fornecidos, funcionamento remoto de amigos/nomes, cadastro e acesso da conta de avaliacao. Publicar a politica atualizada e revisar declaracoes separadamente. Estes materiais nao publicam o app e nao garantem aprovacao pela Google.

Referencia oficial consultada em 15/10/2026:
https://support.google.com/googleplay/android-developer/answer/9866151?hl=pt-BR
