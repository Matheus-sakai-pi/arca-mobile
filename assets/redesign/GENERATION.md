# Redesign Assets - 2026-10-13

Generated individually with the built-in image_gen tool; no API/CLI fallback. Reference files are the six user-provided screens in Downloads. These are independent illustrations, never screenshots used as UI. All text, buttons, statistics, names and positions are real React Native components. The two landscapes are opaque; the other eleven PNGs retain true alpha transparency. Existing coin states and avatar_key mappings are unchanged.

Files are bundled from assets/redesign through src/constants/redesignAssets.ts. No external image URLs. Original generated outputs are preserved under .codex/generated_images.

## Final Prompts

### ark-landscape.png

Reference: Imagem do ChatGPT 13 de out. de 2026, 10_09_05-1.png

Transparent background: false

```text
Use case: background-extraction. Produce ONE standalone background illustration asset for a React Native app, not a screenshot. Use the attached screenshot solely as the art reference. Recreate only the bright upper scenic landscape: vivid cyan blue sky, soft white and warm ivory clouds, lush green trees, gently violet rocks, Noah's polished wooden ark standing on a rocky hill on the right. Portrait 1024x1536. Ark visible in upper right third, open blue sky left for real interface title. Lower half should fade naturally into airy pale blue white clouds leaving quiet usable negative space for real components. Match the warm polished dimensional children's animation illustration look, detailed soft lighting of reference. REMOVE ALL UI, text, labels, numbers, cards, buttons, counters, menu, avatar, prophet. No characters. No lettering. This is solely an illustrated landscape background.
```

### valley-landscape.png

Reference: Imagem do ChatGPT 13 de out. de 2026, 10_09_08-4.png

Transparent background: false

```text
Use case: background-extraction. Create ONE standalone portrait scenic background illustration, 1024x1536, extracting ONLY the magical lush valley setting from the reference. No screenshot/UI. Bright cyan sky with luminous ivory clouds in top third, forest trees frame both sides, mossy purple rocks at edges, golden sandy winding path going from foreground into distance, blue haze clouds. Empty broad center for functional learning nodes overlaid in React Native. Style exactly polished softly dimensional animated children's illustration, sunlight vibrant green foliage, warm rocks, clean details. Remove ALL prophet, cards, coins, buttons, text, interface, labels, tab bar. No ark. No words, no letters. Scene only, no embedded interface.
```

### prophet-reading.png

Reference: Imagem do ChatGPT 13 de out. de 2026, 10_09_05-1.png

Transparent background: true

```text
Use case: background-extraction. Isolate and recreate ONE standalone transparent character asset matching the prophet from the reference: friendly elderly man, fluffy cream white wavy hair and thick beard, large warm brown expressive eyes, joyful welcoming smile, ivory robe and vivid red cloak, holding open brown leather Bible with gold cross and gilded page edges with both hands. Waist-up portrait front facing slightly left. Polished dimensional animated film aesthetic exactly reference, warm soft light. Full head, both arms and book visible. Tight framing with small transparent margin. Add the flat soft golden yellow irregular organic backdrop behind this character and a few golden short celebratory rays like reference; rest actual alpha transparent. Absolutely no UI cards, no blue buttons, no typography, no screenshot, no white rectangular background. Single reusable illustrated mascot.
```

### prophet-thinking.png

Reference: Imagem do ChatGPT 13 de out. de 2026, 10_09_09-6.png

Transparent background: true

```text
Use case: background-extraction. Create ONE transparent waist-up mascot asset exactly matching the elderly prophet in reference. Friendly old man with curly ivory hair, fluffy white beard, warm brown big eyes, cream robe and red cloak, holding CLOSED brown gold-edged Bible with gold cross against chest with left arm and touching chin thoughtfully with right hand. Pleasant curious smile looking slightly up left. Same polished rich dimensional animated children's movie style. Soft irregular golden yellow backdrop and three tiny golden accent rays behind head integrated into asset, rest actual transparent alpha. Full head/arms/book visible and tight margins. NO UI, no card, no words, no buttons, no text.
```

### bible-closed.png

Reference: Imagem do ChatGPT 13 de out. de 2026, 10_09_07-3.png

Transparent background: true

```text
Use case: background-extraction. ONE independent transparent illustration asset of the CLOSED Bible shown in upper unit card of reference. Brown textured leather cover, gold decorative corners, prominent golden cross, thick cream pages, red ribbon bookmark, three quarter view resting at an angle. Lush small green leaves behind base, soft yellow rays over it. Polished warm dimensional children's animation illustration exactly like reference. Square tight composition, full book not cropped. No panel no scenery no UI no text or words; real transparent alpha background. Asset reusable in unit headers.
```

### bible-open.png

Reference: Imagem do ChatGPT 13 de out. de 2026, 10_09_05-1.png

Transparent background: true

```text
Use case: background-extraction. ONE independent transparent decorative open Bible asset, match small open book above lesson list in reference. Open thick cream pages with fine abstract gold page strokes, dark purple brown binding, red ribbon, lush teal green leaves behind, few golden celebratory rays above. 3/4 view. Polished luminous dimensional children's animation art, vibrant soft gold warm lighting. Tight square framing, whole book visible. True transparent alpha background. NO words, lettering, UI, screenshot, panel, white square background.
```

### medal-gold.png

Reference: Imagem do ChatGPT 13 de out. de 2026, 10_09_08-5.png

Transparent background: true

```text
Use case: background-extraction. Create ONE standalone luminous polished gold award medal asset matching the medal on gold podium in the reference. Circular luminous polished gold medal with embossed laurel and small star, orange gold ribbon above in V shape. Front view, rich polished dimensional children's animation render, bright soft studio light. Tight square composition full medal visible. Real transparent alpha background. NO number, no words, no text, no podium, no characters, no interface. Single medal only.
```

### medal-silver.png

Reference: Imagem do ChatGPT 13 de out. de 2026, 10_09_08-5.png

Transparent background: true

```text
Use case: background-extraction. Create ONE standalone polished cool silver award medal asset matching the medal on silver podium in the reference. Circular polished cool silver medal with embossed laurel and small star, navy blue ribbon above in V shape. Front view, rich polished dimensional children's animation render, bright soft studio light. Tight square composition full medal visible. Real transparent alpha background. NO number, no words, no text, no podium, no characters, no interface. Single medal only.
```

### medal-bronze.png

Reference: Imagem do ChatGPT 13 de out. de 2026, 10_09_08-5.png

Transparent background: true

```text
Use case: background-extraction. Create ONE standalone polished warm bronze award medal asset matching the medal on bronze podium in the reference. Circular polished warm bronze medal with embossed laurel and small star, orange brown ribbon above in V shape. Front view, rich polished dimensional children's animation render, bright soft studio light. Tight square composition full medal visible. Real transparent alpha background. NO number, no words, no text, no podium, no characters, no interface. Single medal only.
```

### podium-gold.png

Reference: Imagem do ChatGPT 13 de out. de 2026, 10_09_08-5.png

Transparent background: true

```text
Use case: background-extraction. ONE standalone transparent golden podium pedestal asset. Recreate just the tall first-place golden cylindrical rounded display plinth in reference, without the bird, crown, medal, laurels, text, numbers, badges, labels or interface. Vivid sunny warm gold, softly dimensional polished animated-film style. Elliptical subtly beveled top, rich warm gold reflective sides, gentle bottom shadow. Front facing with slight view of top. Portrait composition, entire cylinder visible, tall aspect ratio width:height approximately 0.58. Tight transparent margins. True alpha transparent background, no checkerboard. Blank smooth front surface for real React Native overlays. No glyphs or decorations or writing.
```

### podium-silver.png

Reference: Imagem do ChatGPT 13 de out. de 2026, 10_09_08-5.png

Transparent background: true

```text
Use case: background-extraction. ONE standalone transparent silver-blue podium pedestal asset. Recreate just the second-place cool polished silver lavender blue cylindrical rounded display plinth from reference, without woman, medal, text, numbers, badges or UI. Silvery blue soft metallic sides and ivory specular reflections, dimensional animated-film style, slightly elliptical beveled top, gentle bottom shadow. Front facing with slight view of top. Portrait composition, entire cylinder visible, aspect ratio width:height 0.68. Tight transparent margins. True alpha transparent background. Blank smooth front for React Native overlays. No glyphs or writing or decorations.
```

### podium-bronze.png

Reference: Imagem do ChatGPT 13 de out. de 2026, 10_09_08-5.png

Transparent background: true

```text
Use case: background-extraction. ONE standalone transparent bronze-orange podium pedestal asset. Recreate just third-place warm copper orange cylindrical rounded display plinth in reference, without prophet, medal, text, numbers, badges or interface. Peach copper soft reflective metallic sides, bright ivory warm reflections, polished dimensional animated-film style. Slightly elliptical beveled top, bottom gentle shadow. Front facing with slight view of top. Portrait composition, entire cylinder visible, aspect width:height 0.76, tight transparent margins. Actual alpha transparent background. Blank front for real React Native overlays. No glyphs writing or decorations.
```

### podium-platform.png

Reference: Imagem do ChatGPT 13 de out. de 2026, 10_09_08-5.png

Transparent background: true

```text
Use case: background-extraction. ONE separate horizontal rocky platform decoration asset for leaderboard. Recreate just the rock shelf under the three podiums in the reference: flat warm sandstone top and chunky softly rounded lilac-purple rock face below, lush bright green broad leaves framing sides, a few ivory cloud wisps near bottom. Polished rich dimensional children's animated-film illustration. Wide 1536x640 composition. Flat clear center top to support real UI podiums. True transparent alpha around the platform. No people, no birds, no podiums, no medals, no text, no numbers, no interface, no background landscape. Single standalone platform illustration.
```
