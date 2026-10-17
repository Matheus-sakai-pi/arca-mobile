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

test('overview opens a protected unit route and detail reuses the existing lesson lock logic', async () => {
  const source = async (path: string) => readFile(new URL('../src/' + path, import.meta.url), 'utf8');
  const overview = await source('app/(tabs)/learn.tsx');
  assert.match(overview, /pathname: '\/unit\/\[id\]'/);
  assert.doesNotMatch(overview, /JourneyTrail|expanded|setExpanded/);
  const layout = await source('app/_layout.tsx');
  assert.ok(layout.indexOf('name="unit/[id]"') > layout.indexOf('guard={(!!session || isGuest) && !isRecovery}'));
  assert.ok(layout.indexOf('name="unit/[id]"') < layout.indexOf('</Stack.Protected>', layout.indexOf('guard={(!!session || isGuest) && !isRecovery}')));
  const detail = await source('app/unit/[id].tsx');
  assert.match(detail, /<LearningGate>/);
  assert.match(await source('components/learning/JourneyTrail.tsx'), /lessonStatus\(progress, lesson.id, activeLessonId, course\)/);
  assert.match(detail, /<JourneyTrail lessons=\{unit.lessons\} startIndex=\{startIndex\}/);
  assert.match(detail, /Unidade não encontrada/);
  const card = await source('components/learning/UnitCard.tsx');
  assert.match(card, /completedLessonIds.includes\(lesson.id\)/);
  assert.match(card, /question.type !== 'content_card'/);
  assert.match(card, /unit.lessons.length/);
});
