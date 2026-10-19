# Redesenho de VIP, convites e bateria esgotada

Referencias fornecidas pelo usuario: imagem do comparativo de assinatura e video de 13,86s do paywall. O video foi inspecionado por quadros. As referencias orientam a hierarquia, a area ilustrada, a coluna de beneficios destacada, a selecao de planos e o rodape fixo; nao fornecem alegacoes, periodos gratis ou funcionalidades ao Arca.

- VIP: topo escuro com o mascote original, divisor de nuvens, comparativo Gratis/VIP com coluna verde, planos anuais/mensais selecionaveis, precos junto da acao e avatares exclusivos. O Android continua usando os precos/ofertas retornados pela Play. A previa nao efetua compras.
- Convite: topo verde-claro com barcos ja existentes do Arca, premio de tres dias, sequencia de tres etapas, codigo e status, compartilhamento sempre no rodape. Amizade consentida, elegibilidade e acumulacao permanecem iguais.
- Bateria vazia: ilustracao propria, horario da proxima energia, duas escolhas compactas, confirmacao da tentativa salva e acoes fixas. Mesma composicao antes da licao e ao acabar durante a tentativa. O aviso de pouca energia e os erros de conexao preservam os seus fluxos.

Nao houve alteracao de precos, recompensas, migrations, dados de contas, XP ou regras de cobranca nesta revisao visual. A verificacao da compra continua no backend; os callbacks Android e a restauracao permanecem no controlador de compras existente. O componente passou a fornecer seletores e checkout separadamente para o rodape fixo, sem duplicar o controlador.

## Artes Geradas

Ferramenta integrada de geracao/edicao de imagens, com fundo transparente. As imagens de referencia locais foram vistas antes da edicao; os arquivos originais nao foram sobrescritos. Saidas recortadas apenas nas margens transparentes e redimensionadas proporcionalmente para no maximo 512px. Nao foram reutilizadas artes de concorrentes.

Arquivos usados pelo aplicativo:

- `assets/membership/vip-mascot.png`
- `assets/membership/battery-empty.png`

Prompt final do mascote (referencia: `assets/mascot/idle.png`):

> Use case: identity-preserve. Edit target: the supplied Arca wise elder mascot. Make a new premium celebratory pose of exactly this recognizable mascot: same huge brown eyes, friendly round face, swept silver hair, white beard, ivory robe and red sash, same polished 3D cartoon render. Replace the little brown book with one large glossy vivid pink battery held proudly with both hands at chest level, with a bold white lightning mark. Add a small tasteful golden crown resting on his head. He looks delighted and energetic. Entire character head and torso fit in frame with generous transparent padding, centered. A production mobile UI cutout on a genuinely transparent background. No background scenery, no lettering, no extra characters, no beams, no floating orbs, no watermark. Keep the battery and hands anatomically clean and clearly readable at 180 pixels.

Prompt final da bateria (referencia: `assets/icons/battery-pink.png`):

> Use case: precise-object-edit. Edit target is the supplied Arca pink battery icon. Create a new depleted-battery illustration matching its silhouette: chunky horizontal rounded rectangular battery with a small terminal on the right, white rim and pink casing. Turn its central face into a very pale pink nearly empty battery window, with just one small vivid pink charge segment on the left. Keep a small white lightning bolt on that pink segment, visibly powerless but friendly rather than alarming. Polished dimensional cartoon, soft 3D bevel, white edging, soft contact shadow directly beneath the battery. Slight gentle tilt, centered and fully visible with transparent padding. Actual transparent background, no scenery, no additional objects, no words or numbers, no face or eyes, no logos or watermark. Crisp, simple, readable at 160px. This is a UI illustration for an energy-empty screen.

## Conferencia

Playwright: celular de 320px, celular de 390px e desktop, com capturas de VIP, planos, convite, aviso de pouca energia e bateria vazia. Os testes conferem selecao dos planos, rodape no viewport, ausencia de overflow horizontal, navegacao e retomada da mesma tentativa. Capturas selecionadas em `artifacts/membership/redesign-screenshots/`.

Resultado em 18/10/2026: 309 testes unitarios/integracao e 27 cenarios Playwright passaram. Os tres cenarios novos foram repetidos em 320px depois do ajuste final do preco no rodape. Lint e verificacoes de tipos do app e dos testes passaram. A previa principal respondeu HTTP 200 em `http://localhost:8089/vip`. Nenhum novo AAB ou publicacao de cobranca foi realizado nesta revisao.
