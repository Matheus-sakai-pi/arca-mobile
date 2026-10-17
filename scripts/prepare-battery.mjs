import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const Jimp = createRequire(import.meta.url)('jimp-compact');
const source = 'C:/Users/mathe/.codex/generated_images/01a10dea-ccf2-78d0-8ea5-daced40b2107/exec-26ac3030-e349-47bd-8654-977e0185d94b.png';
await mkdir(new URL('../assets/icons/', import.meta.url), { recursive: true });
const image = await Jimp.read(source);
image.scaleToFit(384, 256);
await image.writeAsync(new URL('../assets/icons/battery-pink.png', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
console.log('Saved optimized transparent battery icon.');
