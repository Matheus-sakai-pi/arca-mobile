import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { journeyCheckpoint } from '../../src/lib/visualContent.ts';

const Jimp = createRequire(import.meta.url)('jimp-compact') as { read: (buffer: Buffer) => Promise<{ bitmap: { width: number; height: number; data: Buffer } }> };

test('chapter panoramas are not rendered or bundled by the app', async () => {
  for (const file of ['src/constants/visualAssets.ts', 'src/components/learning/LessonPlayer.tsx', 'src/app/unit/[id].tsx']) {
    const source = await readFile(new URL(`../../${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /ChapterScene|chapterScenes|assets\/visuals\/.*\.jpg/);
  }
});

test('illustrated checkpoints reflect genuine completed counts without awarding a reward', () => {
  assert.deepEqual(journeyCheckpoint(0, 10), { done: 0, total: 10, target: 5, reached: false, finished: false });
  assert.deepEqual(journeyCheckpoint(5, 10), { done: 5, total: 10, target: 10, reached: true, finished: false });
  assert.deepEqual(journeyCheckpoint(15, 10), { done: 10, total: 10, target: 10, reached: true, finished: true });
  assert.equal(journeyCheckpoint(-3, 10)!.done, 0);
  assert.equal(journeyCheckpoint(3, 5)!.target, 5);
  assert.equal(journeyCheckpoint(2, 0), null);
  assert.equal(journeyCheckpoint(NaN, 10), null);
  assert.equal(journeyCheckpoint(2, Infinity), null);
});

test('seven retained cutouts are nonblank, preserve alpha and stay within the asset budget', async () => {
  const root = new URL('../../assets/visuals/', import.meta.url);
  const files = (await readdir(root)).filter(file => file.endsWith('.png'));
  assert.equal(files.length, 7);
  const hashes = new Set<string>();
  let total = 0;
  for (const file of files) {
    const url = new URL(file, root), buffer = await readFile(url);
    total += (await stat(url)).size;
    hashes.add(createHash('sha256').update(buffer).digest('hex'));
    const { bitmap } = await Jimp.read(buffer);
    assert.ok(bitmap.width >= 512 && bitmap.width <= 960, file);
    let visible = 0, transparent = 0;
    const colors = new Set<number>();
    for (let i = 0; i < bitmap.data.length; i += 4) {
      if (bitmap.data[i + 3]! > 20) { visible++; colors.add(bitmap.data.readUInt32BE(i)); }
      else transparent++;
    }
    assert.ok(visible > 10000 && colors.size > 1000, `${file} must not be a blank placeholder`);
    if (file.endsWith('.png')) { assert.equal(buffer[25], 6); assert.ok(transparent > 1000, file); }
  }
  assert.equal(hashes.size, 7);
  assert.ok(total < 6 * 1024 * 1024, `Asset payload: ${total}`);
});

test('new visual motion is bounded, optional and never writes learning or account data', async () => {
  for (const name of ['VisualArtwork', 'VisualBurst']) {
    const source = await readFile(new URL(`../../src/components/animation/${name}.tsx`, import.meta.url), 'utf8');
    assert.match(source, /useMotionPreference/);
    assert.match(source, /ReduceMotion.System/);
    assert.match(source, /cancelAnimation/);
    assert.match(source, /AppState/);
    assert.doesNotMatch(source, /setInterval|setTimeout|supabase|finishLesson\(|completeLesson\(/);
  }
  const art = await readFile(new URL('../../src/components/animation/VisualArtwork.tsx', import.meta.url), 'utf8');
  assert.match(art, /\), 2, false/);
  const burst = await readFile(new URL('../../src/components/animation/VisualBurst.tsx', import.meta.url), 'utf8');
  assert.match(burst, /ledger.claim\('visual-burst'/);
});
