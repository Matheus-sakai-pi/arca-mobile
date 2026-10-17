import fs from 'node:fs/promises';
import path from 'node:path';
import Jimp from 'jimp-compact';

const root = path.resolve(import.meta.dirname, '..');
const manifest = JSON.parse(await fs.readFile(path.join(root, 'artifacts/visual-collection/manifest.json'), 'utf8'));
const output = path.join(root, 'assets/visuals');
await fs.mkdir(output, { recursive: true });
for (const item of manifest) {
  const image = await Jimp.read(item.source);
  image.scaleToFit(item.transparent ? 512 : 960, item.transparent ? 512 : 640);
  if (!item.transparent) image.quality(86);
  const filename = `${item.key}.${item.transparent ? 'png' : 'jpg'}`;
  await image.writeAsync(path.join(output, filename));
  const { size } = await fs.stat(path.join(output, filename));
  console.log(`${filename}: ${Math.round(size / 1024)} KB`);
}
