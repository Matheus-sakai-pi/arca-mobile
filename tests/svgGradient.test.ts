import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import ts from 'typescript';

test('Gloss numeric stops retain the intended gradient without warnings from the installed native SVG parser', async () => {
  const source = await readFile(new URL('../src/components/common/Gloss.tsx', import.meta.url), 'utf8');
  const tree = ts.createSourceFile('Gloss.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const offsets: number[] = [];
  const opacities: number[] = [];
  function visit(node: ts.Node) {
    if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name)) {
      const name = node.name.text;
      if (name === 'offset' || name === 'strokeOpacity') {
        const value = node.initializer;
        assert.ok(value && ts.isJsxExpression(value) && value.expression && ts.isNumericLiteral(value.expression), name + ' must be numeric');
        const number = Number(value.expression.text);
        assert.ok(Number.isFinite(number) && number >= 0 && number <= 1);
        (name === 'offset' ? offsets : opacities).push(number);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  assert.deepEqual(offsets, [0, 0.62, 1]);
  assert.deepEqual(opacities, [0.3, 0.12]);

  const nativeSource = await readFile(new URL('../node_modules/react-native-svg/src/lib/extract/extractGradient.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(nativeSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const warnings: string[] = [];
  const module = { exports: {} as { default: (props: { id: string; children: React.ReactElement[] }, parent: unknown) => { gradient: number[] } } };
  // Run the actual installed offset parser; unrelated native color/transform APIs are isolated.
  runInNewContext(compiled, {
    module, exports: module.exports,
    console: { warn: (message: string) => warnings.push(message) },
    require: (name: string) => {
      if (name === 'react') return React;
      if (name === 'react-native') return { processColor: () => 0xff0964ff };
      if (name === './extractOpacity') return (opacity = 1) => opacity;
      if (name === './extractTransform') return () => [];
      if (name === '../units') return { objectBoundingBox: 0 };
      throw new Error('Unexpected dependency: ' + name);
    },
  });
  const extract = (values: readonly (number | string)[]) => module.exports.default({
    id: 'gloss-test',
    children: values.map((offset, index) => React.createElement('Stop', { key: index, offset, stopColor: '#0964ff' })),
  }, null);
  extract([0, '.62', 1]);
  assert.match(warnings[0]!, /not a valid number or percentage string/);
  warnings.length = 0;
  const result = extract(offsets);
  assert.deepEqual(Array.from(result.gradient).filter((_, index) => index % 2 === 0), offsets);
  assert.deepEqual(warnings, []);
});

test('Gloss covers measured button bounds on Android, rounds outward and updates after resize', async () => {
  const source = await readFile(new URL('../src/components/common/Gloss.tsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  type Size = { width: number; height: number };
  type Frame = { children: React.ReactElement<Size> | null; style: { pointerEvents: string }; onLayout: (event: { nativeEvent: { layout: Size } }) => void };
  let size: Size = { width: 0, height: 0 };
  const module = { exports: {} as { Gloss: (props: { streak: boolean }) => React.ReactElement<Frame> } };
  runInNewContext(compiled, {
    module, exports: module.exports,
    require: (name: string) => {
      if (name === 'react/jsx-runtime') return jsxRuntime;
      if (name === 'react') return {
        useId: () => 'gloss-layout-test',
        useState: () => [size, (update: (previous: Size) => Size) => { size = update(size); }],
      };
      if (name === 'react-native') return { View: 'View', StyleSheet: { create: (styles: unknown) => styles } };
      if (name === 'react-native-svg') return { __esModule: true, default: 'Svg', Defs: 'Defs', LinearGradient: 'LinearGradient', Path: 'Path', Rect: 'Rect', Stop: 'Stop' };
      throw new Error('Unexpected dependency: ' + name);
    },
  });
  const render = () => module.exports.Gloss({ streak: true });
  const measure = (width: number, height: number) => render().props.onLayout({ nativeEvent: { layout: { width, height } } });
  assert.equal(render().props.children, null);
  assert.equal(render().props.style.pointerEvents, 'none');
  for (const [width, height] of [[288, 64], [342.4, 63.2], [160, 88], [480, 72]]) {
    measure(width!, height!);
    const svg = render().props.children;
    assert.ok(svg);
    assert.equal(svg.props.width, Math.ceil(width!));
    assert.equal(svg.props.height, Math.ceil(height!));
    const previous = size;
    measure(width!, height!);
    assert.equal(size, previous, 'unchanged layout must not trigger a new state object');
  }
  measure(0, 0);
  assert.equal(render().props.children, null);
  const button = await readFile(new URL('../src/components/common/Button.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(button, /<Gloss/);
  assert.match(button, /translateY: 4/);
});
