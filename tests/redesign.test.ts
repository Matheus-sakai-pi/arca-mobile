import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
const illustrations = ['ark-landscape','valley-landscape','prophet-reading','prophet-thinking','bible-closed','bible-open','medal-gold','medal-silver','medal-bronze','podium-gold','podium-silver','podium-bronze','podium-platform'];
test('redesign uses thirteen separate high-resolution PNG illustrations and real transparency for cutouts', async () => {
  for (const name of illustrations) {
    const png = await readFile(new URL('../assets/redesign/' + name + '.png', import.meta.url));
    assert.equal(png.subarray(1,4).toString(), 'PNG');
    assert.ok(png.readUInt32BE(16) >= 512, name);
    assert.ok(png.readUInt32BE(20) >= 512, name);
    if (!name.endsWith('landscape')) assert.equal(png[25], 6, name + ' must retain RGBA transparency');
  }
});
test('assets stay local, tabs use the flat white background and exercises keep a quiet background', async () => {
  const registry = await readFile(new URL('../src/constants/redesignAssets.ts', import.meta.url), 'utf8');
  for (const name of illustrations) assert.ok(registry.includes(name + '.png'));
  assert.doesNotMatch(registry, /https?:/);
  for (const path of ['(tabs)/home.tsx','(tabs)/learn.tsx','(tabs)/ranking.tsx','(tabs)/profile.tsx','(tabs)/friends.tsx','(tabs)/achievements.tsx']) {
    const source = await readFile(new URL('../src/app/' + path, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /scene="(ark|valley)"|sceneScrolls/, path);
  }
  const player = await readFile(new URL('../src/components/learning/LessonPlayer.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(player, /<Screen[^>]*scene=/);
  assert.match(player, /playFeedbackSound\(correct \? 'correct' : 'wrong'\)/);
  assert.match(player, /finishLesson\(lesson/);
});
test('visual refinements keep blur opt-in, remove the redundant heading and keep results unframed', async () => {
  const source = async (path: string) => readFile(new URL('../' + path, import.meta.url), 'utf8');
  const learn = await source('src/app/(tabs)/learn.tsx');
  assert.doesNotMatch(learn, /TabHeader|Um passo de cada vez/);
  // A aba Aprender é a trilha única, em fundo branco, sem cenário.
  assert.match(learn, /<Screen\s+style=\{styles.content\}/);
  assert.doesNotMatch(learn, /scene=/);
  const screen = await source('src/components/common/Screen.tsx');
  assert.match(screen, /backgroundBlur = 0/);
  assert.match(screen, /blurRadius=\{backgroundBlur\}/);
  const result = await source('src/app/lesson/result.tsx');
  assert.doesNotMatch(result, /<Screen[^>]*scene=|borderRadius:28/);
  assert.doesNotMatch(result, /rgba\(255,255,255/);
  const profile = await source('src/app/(tabs)/profile.tsx');
  assert.doesNotMatch(profile, /TabHeader/);
  assert.match(profile, /accessibilityRole="header" style=\{styles.title\}>Perfil/);
  assert.match(profile, /fontFamily: fonts.heavy, fontSize: 32, lineHeight: 40, color: colors.text/);
  assert.doesNotMatch(profile, /textShadowColor/);
  const ranking=await source('src/app/(tabs)/ranking.tsx');
  assert.doesNotMatch(ranking,/TabHeader/);
  assert.doesNotMatch(ranking,/textShadowColor/);
  assert.match(ranking,/appearance="ranking"/);
});

test('tabs stay white (scenery stays available for special moments) and the lesson trail stays white', async () => {
  const source = async (path: string) => readFile(new URL('../' + path, import.meta.url), 'utf8');
  for (const route of ['home', 'profile', 'ranking', 'learn']) assert.doesNotMatch(await source(`src/app/(tabs)/${route}.tsx`), /sceneScrolls/);
  const trail = await source('src/app/(tabs)/learn.tsx');
  assert.doesNotMatch(trail, /scene="valley"|scene="ark"/);
  assert.doesNotMatch(trail, /sceneScrolls/);
  const screen = await source('src/components/common/Screen.tsx');
  assert.match(screen, /sceneScrolls = false/);
  assert.ok(screen.indexOf('<ScrollingIllustration') > screen.indexOf('<ScrollView ref='));
  const scene = await source('src/components/common/ScrollingIllustration.tsx');
  assert.match(scene, /aspectRatio: 2 \/ 3/);
  assert.match(scene, /pointerEvents="none"/);
  assert.match(scene, /stopColor=\{colors.background\}/);
  for (const name of ['ark', 'valley']) {
    const png = await readFile(new URL(`../assets/redesign/${name}-landscape.png`, import.meta.url));
    assert.equal(png.readUInt32BE(16) / png.readUInt32BE(20), 2 / 3);
  }
});
