import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parse } from '@vue/compiler-sfc';
import ts from 'typescript';
import { computed, ref, watch, nextTick } from 'vue';

function viewer() {
  const source = readFileSync(
    new URL('../app/components/shared/PhotoViewer.vue', import.meta.url),
    'utf8',
  );
  const script = parse(source).descriptor.scriptSetup!.content.replaceAll(
    'import.meta.client',
    'false',
  );
  const code = ts.transpileModule(script, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return new Function(
    'exports',
    'defineProps',
    'withDefaults',
    'defineModel',
    'computed',
    'ref',
    'watch',
    'nextTick',
    'onBeforeUnmount',
    'useFileDownload',
    `${code}
    return { onPointerDown, onPointerMove, onPointerUp, zoom, pan, selectedIndex };
  `,
  )(
    {},
    () => ({ items: [{ mime_type: 'image/jpeg' }, { mime_type: 'image/jpeg' }], images: [] }),
    (props: unknown) => props,
    (name: string) => ref(name === 'index' ? 0 : true),
    computed,
    ref,
    watch,
    nextTick,
    () => {},
    () => ({ downloadingKey: ref(null) }),
  );
}

const pointer = (id: number, x: number, y = 100, type = 'pointerup') => ({
  pointerId: id,
  clientX: x,
  clientY: y,
  pointerType: 'touch',
  type,
  currentTarget: null,
});

test('pinch zooms, continues with one-finger pan, and never swipes on release', () => {
  const view = viewer();
  view.onPointerDown(pointer(1, 100));
  view.onPointerDown(pointer(2, 200));
  view.onPointerMove(pointer(2, 300));
  assert.equal(view.zoom.value, 2);
  view.onPointerUp(pointer(2, 300));
  view.onPointerMove(pointer(1, 150, 130));
  assert.deepEqual(view.pan.value, { x: 50, y: 30 });
  view.onPointerUp(pointer(1, 150, 130));
  assert.equal(view.selectedIndex.value, 0);
});

test('horizontal swipes navigate in both directions, vertical and cancelled gestures do not', () => {
  const view = viewer();
  view.onPointerDown(pointer(1, 200));
  view.onPointerUp(pointer(1, 100));
  assert.equal(view.selectedIndex.value, 1);
  view.onPointerDown(pointer(1, 100));
  view.onPointerUp(pointer(1, 200));
  assert.equal(view.selectedIndex.value, 0);
  view.onPointerDown(pointer(1, 200));
  view.onPointerUp(pointer(1, 100, 300));
  view.onPointerDown(pointer(1, 200));
  view.onPointerUp(pointer(1, 100, 100, 'pointercancel'));
  assert.equal(view.selectedIndex.value, 0);
});

test('pinching back to normal size cannot turn into a swipe', () => {
  const view = viewer();
  view.onPointerDown(pointer(1, 100));
  view.onPointerDown(pointer(2, 300));
  view.onPointerMove(pointer(2, 200));
  assert.equal(view.zoom.value, 0.5);
  view.onPointerUp(pointer(2, 200));
  view.onPointerUp(pointer(1, 0));
  assert.equal(view.selectedIndex.value, 0);
});
