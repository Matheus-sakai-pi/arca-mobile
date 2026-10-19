import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import ts from 'typescript';
import type { LeaderboardEntry } from '../src/types/leaderboard.ts';

type Element = React.ReactElement<Record<string, unknown>>;
async function loadPodium(fontScale = 1, width = 390, nameHeights:Record<string,number> = {}) {
  const source = await readFile(new URL('../src/components/leaderboard/LeaderboardPodium.tsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const module = { exports: {} as { LeaderboardPodium: (props: { entries: LeaderboardEntry[]; currentUserId: string | null }) => Element } };
  runInNewContext(compiled, {
    module, exports: module.exports,
    require: (name: string) => {
      if (name === 'react/jsx-runtime') return jsxRuntime;
      if (name === 'react') return {useState:()=>[nameHeights,()=>undefined]};
      if (name === 'react-native') return { Image: 'Image', View: 'View', useWindowDimensions: () => ({ fontScale, width }), StyleSheet: { create: (styles: unknown) => styles } };
      if (name === 'lucide-react-native') return { Crown: 'Crown' };
      if (name.endsWith('/Avatar')) return { Avatar: 'Avatar' };
      if (name.endsWith('/ProfileDecoration')) return { ProfileAvatar: 'ProfileAvatar', VIPBadge: 'VIPBadge' };
      if (name.endsWith('/AppText')) return { AppText: 'AppText' };
      if (name.endsWith('/PodiumEntrance')) return { PodiumEntrance: 'PodiumEntrance' };
      if (name.endsWith('/AnimatedRankChange')) return { AnimatedRankChange: 'AnimatedRankChange' };
      if (name.endsWith('/redesignAssets')) return { redesignAssets: { platform: 'platform', podiums: { 1: 'gold', 2: 'silver', 3: 'bronze' }, medals: { 1: 'gold', 2: 'silver', 3: 'bronze' } } };
      if (name.endsWith('/theme')) return { colors: { primary: 'blue', surface: 'white' }, fonts:{heavy:'Nunito'},layout:{maxWidth:480}, radius: { pill: 999 }, spacing: { xs: 8,md:16 } };
      throw new Error('Unexpected dependency: ' + name);
    },
  });
  return module.exports.LeaderboardPodium;
}
function elements(tree: unknown): Element[] {
  if (Array.isArray(tree)) return tree.flatMap(elements);
  if (!React.isValidElement(tree)) return [];
  const element = tree as Element;
  return [element, ...elements(element.props.children)];
}
function style(element: Element) {
  return Object.assign({}, ...[element.props.style].flat().filter(Boolean)) as Record<string, unknown>;
}
const entries: LeaderboardEntry[] = [1, 2, 3].map(position => ({ id: `user-${position}`, position, display_name: 'Nome de participante com duas linhas', avatar_key: 'avatar-01', xp_total: 100000 - position, frame: 'classic' as const, vip: false }));

test('native podium uses natural column heights and unpadded full-size pedestal artwork', async () => {
  const render = await loadPodium();
  const all = elements(render({ entries, currentUserId: 'user-3' }));
  for (const column of all.filter(element => typeof element.props.accessibilityLabel === 'string')) {
    assert.equal(style(column).flex, undefined, 'nested vertical columns must not grow independently of the row slots');
  }
  for (const art of all.filter(element => /^podium-art-/.test(String(element.props.testID)))) {
    const bounds = style(art);
    assert.equal(bounds.position, 'absolute');
    for (const edge of ['top', 'left', 'right', 'bottom']) assert.equal(bounds[edge], 0);
    assert.equal(bounds.width, undefined, 'percentage width in a padded parent must not shrink the art');
    assert.equal(bounds.height, undefined, 'percentage height in a padded parent must not shrink the art');
  }
});

test('measured long names grow every pedestal equally instead of shrinking participant names',async()=>{
  const key=`${entries[1]!.id}:${entries[1]!.display_name}:1`;
  const render=await loadPodium(1,320,{[key]:90});
  const all=elements(render({entries,currentUserId:'user-2'}));
  for(const [index,position] of [1,2,3].entries()) {
    const pedestal=all.find(element=>element.props.testID===`podium-pedestal-${position}`)!;
    assert.equal(style(pedestal).height,[228,204,184][index]!+54/(1-0.31));
    const identity=all.find(element=>element.props.testID===`podium-identity-${position}`)!;
    const children=React.Children.toArray(identity.props.children as React.ReactNode) as Element[];
    assert.equal(style(children[0]!).minHeight,90);
    const name=React.Children.only(children[0]!.props.children as React.ReactElement) as Element;
    assert.equal(name.props.numberOfLines,undefined);
    assert.equal(name.props.adjustsFontSizeToFit,undefined);
  }
});

test('podium numbers use a centered front-face area below each bitmap rim', async () => {
  for (const fontScale of [1, 1.6]) {
    for (const currentUserId of [null, 'user-1', 'user-2', 'user-3']) {
      const render = await loadPodium(fontScale);
      const all = elements(render({ entries, currentUserId }));
      for (const [index, position] of [1, 2, 3].entries()) {
        const pedestal = all.find(element => element.props.testID === `podium-pedestal-${position}`)!;
        assert.equal(style(pedestal).paddingTop, Number(style(pedestal).height) * [0.16, 0.31, 0.25][index]!);
        const area = all.find(element => element.props.testID === `podium-rank-${position}`)!;
        assert.equal(style(area).flex, 1);
        assert.equal(style(area).alignItems, 'center');
        assert.equal(style(area).justifyContent, 'center');
        const number = React.Children.only(area.props.children as React.ReactElement) as Element;
        assert.equal(style(number).lineHeight, 36);
        assert.equal(style(number).textAlign, 'center');
        assert.equal(style(number).marginTop, undefined);
      }
    }
  }
});

test('podium heights preserve gold above silver above bronze for every current user and font scale', async () => {
  for (const fontScale of [1, 1.3, 1.6, 2]) {
    const render = await loadPodium(fontScale);
    for (const currentUserId of [null, 'user-1', 'user-2', 'user-3']) {
      const all = elements(render({ entries, currentUserId }));
      const heights = [1, 2, 3].map(position => Number(style(all.find(element => element.props.testID === `podium-pedestal-${position}`)!).height));
      assert.ok(heights[0]! > heights[1]! && heights[1]! > heights[2]!);
      assert.deepEqual(heights, [228, 204, 184].map(height => height * Math.min(fontScale, 1.6)));
      for (const identity of all.filter(element => /^podium-identity-/.test(String(element.props.testID)))) {
        const children = React.Children.toArray(identity.props.children as React.ReactNode) as Element[];
        assert.equal(style(children[2]!).height, 21 * Math.min(fontScale, 1.6), 'the own-user label must reserve the same space for everyone');
      }
    }
  }
});

test('responsive avatar bounds retain a larger winner without overflowing narrow podium slots', async () => {
  for(const width of [320,390,430,1280]) {
    const render=await loadPodium(1,width);
    const all=elements(render({entries,currentUserId:'user-1'}));
    const avatars=[1,2,3].map(position=>all.find(element=>element.props.testID===`podium-avatar-${position}`)!);
    const sizes=avatars.map(avatar=>Number((React.Children.only(avatar.props.children as React.ReactElement) as Element).props.size));
    assert.ok(sizes[0]!>sizes[1]! && sizes[1]===sizes[2]);
    for(const size of sizes) assert.ok(size+12<=(Math.min(width,480)-40)/3);
    assert.ok(!all.some(element=>style(element).width===36 && style(element).height===40),'Redundant medal removed');
  }
});

test('missing participants keep equal horizontal slots without introducing vertical growth', async () => {
  const render = await loadPodium();
  for (const count of [0, 1, 2]) {
    const tree = render({ entries: entries.slice(0, count), currentUserId: null });
    const all = elements(tree);
    assert.equal(all.filter(element => /^podium-pedestal-/.test(String(element.props.testID))).length, count);
    const slots = React.Children.toArray(tree.props.children as React.ReactNode).slice(1);
    assert.equal(slots.length, 3);
  }
});
