import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { learningUnits } from '../src/data/lessons.ts';

test('all curriculum units have their own local artwork, caption and icon', async () => {
  const source = await readFile(new URL('../src/constants/unitArtwork.ts', import.meta.url), 'utf8');
  const entries = [...source.matchAll(/'([^']+)': \{ image: (.+?), caption: '([^']+)', icon: '([^']+)' \}/g)];
  assert.deepEqual(entries.map(entry => entry[1]), learningUnits.map(unit => unit.id));
  assert.equal(new Set(entries.map(entry => entry[2])).size, learningUnits.length);
  assert.doesNotMatch(source, /https?:/);
  const hashes = new Set<string>();
  for (const match of source.matchAll(/assets\/units\/([^']+)\.png/g)) {
    const png = await readFile(new URL(`../assets/units/${match[1]}.png`, import.meta.url));
    assert.equal(png.subarray(1,4).toString(), 'PNG');
    assert.ok(png.readUInt32BE(16) >= 512 && png.readUInt32BE(20) >= 512);
    assert.equal(png[25],6,'Cutouts retain RGBA transparency');
    hashes.add(createHash('sha256').update(png).digest('hex'));
  }
  assert.equal(hashes.size,8);
});

test('learn tab is one journey through every unit, with a colored banner per unit and the existing lock logic', async () => {
  const source = async (path: string) => readFile(new URL('../src/' + path, import.meta.url), 'utf8');
  const learn = await source('app/(tabs)/learn.tsx');
  // Trilha única: todas as unidades em sequência, sem a lista intermediária de unidades.
  assert.match(learn, /units.map\(\(unit, index\) =>/);
  assert.match(learn, /<UnitBanner unit=\{unit\} index=\{index\} progress=\{progress\} \/>/);
  assert.match(learn, /<JourneyTrail lessons=\{unit.lessons\} startIndex=\{starts\[index\]\} color=\{unitTrailTheme\(index\).color\}/);
  assert.match(learn, /initialScrollTarget=\{currentLessonRef\}/);
  assert.match(await source('components/learning/JourneyTrail.tsx'), /lessonStatus\(progress, lesson.id, activeLessonId, course\)/);
  const banner = await source('components/learning/UnitBanner.tsx');
  assert.match(banner, /completedLessonIds.includes\(lesson.id\)/);
  assert.match(banner, /backgroundColor: theme.color/);
  // Links antigos para uma unidade levam à trilha única.
  assert.match(await source('app/unit/[id].tsx'), /<Redirect href="\/\(tabs\)\/learn" \/>/);
});
