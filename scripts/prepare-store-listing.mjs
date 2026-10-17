import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const sharp = require('sharp');
export const destination = resolve('artifacts/play-store/2026-10-15');
export const listing = JSON.parse(await readFile('store/pt-BR/listing.json', 'utf8'));
assert.ok(listing.title.length <= 30);
assert.ok(listing.shortDescription.length <= 80);
assert.ok(listing.fullDescription.length <= 4000);
assert.ok(listing.releaseNotes.length <= 500);
assert.ok(listing.featureGraphicAlt.length <= 140);
assert.equal(listing.screenshots.length, 8);
for (const shot of listing.screenshots) assert.ok(shot.alt.length <= 140);

if (process.argv[1] && resolve(process.argv[1]) === resolve('scripts/prepare-store-listing.mjs')) {
  const featureSource = process.argv[2];
  assert.ok(featureSource, 'Provide the generated feature graphic source path');
  await mkdir(resolve(destination, 'capturas'), { recursive: true });
  await mkdir(resolve(destination, 'textos'), { recursive: true });
  for (const [file, content] of [
    ['nome.txt', listing.title], ['descricao-curta.txt', listing.shortDescription],
    ['descricao-completa.txt', listing.fullDescription], ['novidades.txt', listing.releaseNotes],
    ['textos-alternativos.txt', `destaque-1024x500.png\n${listing.featureGraphicAlt}\n\n` + listing.screenshots.map(item => `${item.file}\n${item.alt}`).join('\n\n')],
  ]) await writeFile(resolve(destination, 'textos', file), content + '\n', 'utf8');
  await sharp('store/pt-BR/icon-mascot-blue.png').resize(512, 512).ensureAlpha().png().toFile(resolve(destination, 'icone-512.png'));
  await sharp(featureSource).resize(1024, 500, { fit: 'cover', position: 'centre' }).removeAlpha().toColourspace('srgb').png().toFile(resolve(destination, 'destaque-1024x500.png'));
  for (const [file, width, height, channels] of [['icone-512.png', 512, 512, 4], ['destaque-1024x500.png', 1024, 500, 3]]) {
    const metadata = await sharp(resolve(destination, file)).metadata();
    assert.equal(metadata.width, width); assert.equal(metadata.height, height); assert.equal(metadata.channels, channels);
    if (file.startsWith('icone')) assert.ok((await readFile(resolve(destination, file))).length < 1024 * 1024);
  }
  console.log(JSON.stringify({ title: listing.title.length, short: listing.shortDescription.length, full: listing.fullDescription.length, notes: listing.releaseNotes.length, destination }));
}
