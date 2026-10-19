# Personalizacao do perfil VIP

## Implementacao

- Entrada em Perfil > Personalizar perfil. A selecao de avatares existente continua separada.
- Moldura classica gratuita; Dourada, Oliveira e Estelar exclusivas. Brilho breve, sem repeticao infinita, respeitando movimento reduzido.
- Fundo branco gratuito; Jardim, Ceu e Constelacao ilustrados. As imagens ocupam somente a faixa do avatar para manter texto e estatisticas legiveis.
- Selo VIP discreto e opcional, exibido somente com assinatura paga ativa. A previa do editor e identificada como previa.
- Previa sem salvar, cancelamento, restauracao do padrao, erro recuperavel e persistencia na conta entre aparelhos.
- Nesta etapa os estilos aparecem na propria tela Perfil. Avatares nos rankings, amigos e desafios mantem seu comportamento atual.
- Dias por convite nao liberam as personalizacoes VIP.
- Ao expirar, as escolhas premium sao ocultadas, mas mantidas para renovacao. O avatar escolhido segue a regra anterior.
- A atualizacao nao altera XP, bateria, amizades, assinatura ou licoes.

## Supabase

Aplicar uma vez `supabase/migrations/202610180006_profile_appearance.sql`, depois da instalacao de VIP/convites. A copia pronta e `artifacts/membership/ativar-personalizacao-vip.sql`. Nao executar novamente a instalacao original de VIP.

O RPC `learning_profile_appearance` usa somente auth.uid(), valida o catalogo e consulta a verificacao paga existente. A tabela privada tem RLS e nao permite leitura ou escrita direta pelos clientes. Exclusao da conta remove as escolhas por cascata. O app nao salva escolhas localmente como se fossem confirmadas pelo servidor; sem conexao, novas gravacoes falham e podem ser repetidas.

A migration nao foi aplicada remotamente por esta implementacao. O AAB versionCode 8 nao foi alterado nem outro build foi iniciado.

## Validacao

316 testes unitarios/integracao passaram. Os 12 cenarios finais de personalizacao passaram no Playwright (320px, 390px e desktop), incluindo erro de leitura, erro de gravacao, tentativa novamente, cancelamento, selo opcional e premio por convite sem VIP. Outros 24 cenarios de regressao de perfil e assinatura tambem foram executados com sucesso. Lint e verificacoes de tipos do app e testes passaram.

Capturas finais: `artifacts/membership/profile-personalization/editor-320.png` e `perfil-320.png`. Nao houve teste de instalacao Android ou compra real nesta etapa.

## Artes

Geradas com a ferramenta integrada de imagens, sem API/CLI externa. Fontes originais preservadas em C:/Users/mathe/.codex/generated_images/01a10dea-ccf2-78d0-8ea5-daced40b2107/. Os PNGs usados no projeto foram reduzidos proporcionalmente para 512x512, sem editar o conteudo.

Arquivos finais:
- C:/Users/mathe/.codex/.chatgpt-projects/g-p-6ac4124455988191b94724c1d08cec26/arca-mobile/assets/profile/garden.png
- C:/Users/mathe/.codex/.chatgpt-projects/g-p-6ac4124455988191b94724c1d08cec26/arca-mobile/assets/profile/sky.png
- C:/Users/mathe/.codex/.chatgpt-projects/g-p-6ac4124455988191b94724c1d08cec26/arca-mobile/assets/profile/stars.png

Prompts finais:

### Jardim
Use case: stylized-concept. Asset type: square decorative profile background texture for Arca, a warm cartoon Bible-learning mobile app. Create one original polished illustration of a sparse olive garden pattern: sculpted soft 3D cartoon olive branches and emerald/sage leaves entering from the four outer edges, a few tiny white blossoms. Flat very light mint background, large uncluttered center for an avatar overlay. Elegant playful clay-render material with subtle shading. Square image; not a landscape, no horizon, no cards, no UI, no text, no logos, no border, no characters, no floating spheres, no bokeh. The central horizontal band must remain readable and nearly empty when cropped to a wide short profile cover. Restrained detail, premium but calm.

### Ceu
Use case: stylized-concept. Asset type: square decorative profile background texture for Arca, a polished cartoon Bible-learning mobile app. One original premium illustration of a bright tranquil sky: rounded sculpted white clouds along the left and right edges and corners, a few tiny warm golden four-point star accents, flat pale sky-blue center. Soft 3D clay cartoon rendering, clean distinct shapes, crisp daylight, large uncluttered center for an avatar overlay. Square image, not a landscape, no horizon, no cards, no UI, no text, no logos, no characters, no floating spheres, no bokeh or gradient blobs. The central horizontal band must remain nearly empty when cropped to a wide short profile cover; edge clouds should still be visible.

### Constelacao
Use case: stylized-concept. Asset type: square decorative profile background texture for Arca, a premium friendly cartoon Bible-learning app. Original flat deep plum night-sky backdrop, embellished around the left and right edges with a small sparse collection of sculpted golden four-point stars and delicate thin constellation lines. A few ivory tiny pinpoints, no glow or blurred lighting. Soft polished clay 3D look on the stars, quiet matte plum field. Large uncluttered center for a circular avatar overlay. Square, not a landscape, no horizon, no moon, no floating spheres, no bokeh, no gradient orbs, no text, no labels, no UI, no logo, no character. The central horizontal band is used as a wide short profile cover so distribute a few elegant stars at the mid-left and mid-right edges as well as the corners.
