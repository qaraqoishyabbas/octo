import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parse } from '@vue/compiler-sfc';
import ts from 'typescript';
import { computed, ref, watch, nextTick } from 'vue';
import dayjs from 'dayjs';

function viewer(reducedMotion = false, itemCount = 2, allowAutoLoad = true, metadata = {}) {
  const timers = new Map<number, () => void>();
  let timerId = 0;
  const source = readFileSync(
    new URL('../app/components/shared/PhotoViewer.vue', import.meta.url),
    'utf8',
  );
  const script = parse(source).descriptor.scriptSetup!.content.replaceAll(
    'import.meta.client',
    'true',
  );
  const code = ts.transpileModule(script, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const view = new Function(
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
    'useMediaAutoDownloadStore',
    'useMediaCacheSource',
    'useDayjs',
    '$storage',
    'window',
    'setTimeout',
    'clearTimeout',
    `${code}
    return { onPointerDown, onPointerMove, onPointerUp, zoom, pan, selectedIndex, open, imageTransform, swipeOffset, settling, slideStyle, navigateMedia, closeViewer, onViewerKeydown, adjacentMedia, viewerTitle, viewerSubtitle };
  `,
  )(
    {},
    () => ({
      items: Array.from({ length: itemCount }, () => ({ mime_type: 'image/jpeg' })),
      images: [],
      ...metadata,
    }),
    (props: unknown) => props,
    (name: string) => ref(name === 'index' ? 0 : true),
    computed,
    ref,
    watch,
    nextTick,
    () => {},
    () => ({ downloadingKey: ref(null) }),
    () => ({ canAutoLoad: () => allowAutoLoad }),
    (_file: unknown, url: { value: string }, enabled: { value: boolean }) => ({
      source: computed(() => (enabled.value ? url.value : undefined)),
    }),
    () => dayjs,
    (path: string) => path,
    {
      innerWidth: 400,
      innerHeight: 800,
      matchMedia: () => ({ matches: reducedMotion }),
      addEventListener() {},
      removeEventListener() {},
    },
    (callback: () => void) => {
      timers.set(++timerId, callback);
      return timerId;
    },
    (id: number) => timers.delete(id),
  );
  return {
    ...view,
    finishAnimation() {
      const pending = [...timers.values()];
      timers.clear();
      pending.forEach((callback) => callback());
    },
  };
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

test('image follows finger and settles in both directions before switching media', () => {
  const view = viewer();
  view.onPointerDown(pointer(1, 200));
  view.onPointerMove(pointer(1, 100));
  assert.deepEqual(view.swipeOffset.value, { x: -100, y: 0 });
  assert.equal(view.slideStyle.value.transform, 'translate3d(-100px, 0px, 0)');
  assert.equal(view.slideStyle.value.transition, 'none');
  view.onPointerUp(pointer(1, 100));
  assert.equal(view.selectedIndex.value, 0);
  assert.equal(view.settling.value, true);
  assert.equal(view.swipeOffset.value.x, -400);
  view.finishAnimation();
  assert.equal(view.selectedIndex.value, 1);
  assert.deepEqual(view.swipeOffset.value, { x: 0, y: 0 });
  view.onPointerDown(pointer(1, 100));
  view.onPointerUp(pointer(1, 200));
  assert.equal(view.swipeOffset.value.x, 400);
  view.finishAnimation();
  assert.equal(view.selectedIndex.value, 0);
});

test('downward swipe closes only after dismissal completes', async () => {
  const view = viewer();
  view.onPointerDown(pointer(1, 100));
  view.onPointerMove(pointer(1, 110, 260));
  assert.equal(view.swipeOffset.value.y, 160);
  view.onPointerUp(pointer(1, 110, 260));
  assert.equal(view.open.value, true);
  assert.equal(view.swipeOffset.value.y, 800);
  view.finishAnimation();
  assert.equal(view.open.value, false);
  await nextTick();
  assert.equal(view.swipeOffset.value.y, 800);
  assert.equal(view.selectedIndex.value, 0);
  view.open.value = true;
  await nextTick();
  assert.deepEqual(view.swipeOffset.value, { x: 0, y: 0 });
});

test('short, upward, diagonal and cancelled drags return to origin', () => {
  for (const [x, y, type] of [
    [125, 100, 'pointerup'],
    [100, -100, 'pointerup'],
    [200, 220, 'pointerup'],
    [0, 100, 'pointercancel'],
    [100, 300, 'lostpointercapture'],
  ] as const) {
    const view = viewer();
    view.onPointerDown(pointer(1, 100));
    view.onPointerMove(pointer(1, x, y));
    view.onPointerUp(pointer(1, x, y, type));
    assert.deepEqual(view.swipeOffset.value, { x: 0, y: 0 });
    view.finishAnimation();
    assert.equal(view.selectedIndex.value, 0);
    assert.equal(view.open.value, true);
  }
});

test('pinch cancels in-progress dismissal and cannot dismiss on remaining finger release', () => {
  const view = viewer();
  view.onPointerDown(pointer(1, 100));
  view.onPointerMove(pointer(1, 100, 250));
  view.onPointerDown(pointer(2, 200, 250));
  assert.deepEqual(view.swipeOffset.value, { x: 0, y: 0 });
  view.onPointerMove(pointer(2, 150, 250));
  view.onPointerUp(pointer(2, 150, 250));
  view.onPointerMove(pointer(1, 100, 500));
  view.onPointerUp(pointer(1, 100, 500));
  view.finishAnimation();
  assert.equal(view.open.value, true);
  assert.equal(view.selectedIndex.value, 0);
});

test('reduced motion navigates and dismisses without waiting for animation', () => {
  const view = viewer(true);
  view.navigateMedia(1);
  assert.equal(view.selectedIndex.value, 1);
  view.onPointerDown(pointer(1, 100));
  view.onPointerUp(pointer(1, 100, 300));
  assert.equal(view.open.value, false);
});

test('settling ignores new gestures and close cancels pending navigation', () => {
  const view = viewer();
  view.navigateMedia(1);
  view.onPointerDown(pointer(1, 100));
  view.onPointerUp(pointer(1, 300));
  view.closeViewer();
  view.finishAnimation();
  assert.equal(view.open.value, false);
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

test('a single image resists horizontal swipes and stays selected', () => {
  const view = viewer(false, 1);
  view.onPointerDown(pointer(1, 200));
  view.onPointerMove(pointer(1, 100));
  assert.deepEqual(view.swipeOffset.value, { x: -20, y: 0 });
  view.onPointerUp(pointer(1, 100));
  view.finishAnimation();
  assert.equal(view.selectedIndex.value, 0);
  assert.equal(view.open.value, true);
});

test('zoomed single-finger dragging pans without navigation or dismissal', () => {
  const view = viewer();
  view.zoom.value = 2;
  view.onPointerDown(pointer(1, 200));
  view.onPointerMove(pointer(1, 0, 350));
  assert.deepEqual(view.pan.value, { x: -200, y: 250 });
  assert.deepEqual(view.swipeOffset.value, { x: 0, y: 0 });
  view.onPointerUp(pointer(1, 0, 350));
  view.finishAnimation();
  assert.equal(view.open.value, true);
  assert.equal(view.selectedIndex.value, 0);
});

test('keyboard arrows animate and wrap gallery navigation while Escape closes', () => {
  const view = viewer();
  view.onViewerKeydown({ key: 'ArrowLeft', preventDefault() {} });
  assert.equal(view.selectedIndex.value, 0);
  assert.equal(view.swipeOffset.value.x, 400);
  view.finishAnimation();
  assert.equal(view.selectedIndex.value, 1);
  view.onViewerKeydown({ key: 'ArrowRight', preventDefault() {} });
  view.finishAnimation();
  assert.equal(view.selectedIndex.value, 0);
  view.onViewerKeydown({ key: 'Escape', preventDefault() {} });
  assert.equal(view.open.value, false);
});

test('opening media manually cannot preload gated neighbors until navigation requests them', () => {
  const view = viewer(false, 3, false);
  assert.deepEqual(
    view.adjacentMedia.value.map((item: { loadAllowed: boolean }) => item.loadAllowed),
    [false, false],
  );
  view.onPointerDown(pointer(1, 200));
  view.onPointerMove(pointer(1, 100));
  assert.deepEqual(
    view.adjacentMedia.value.map((item: { loadAllowed: boolean }) => item.loadAllowed),
    [false, true],
  );
  view.onPointerUp(pointer(1, 100));
  view.finishAnimation();
  assert.equal(view.selectedIndex.value, 1);
  assert.deepEqual(
    view.adjacentMedia.value.map((item: { loadAllowed: boolean }) => item.loadAllowed),
    [false, false],
  );
  view.closeViewer();
  assert.deepEqual(view.adjacentMedia.value, []);
});

test('sent media header shows each sender and sending time when navigating profile photos', () => {
  const view = viewer(false, 2, true, {
    items: [
      {
        mime_type: 'image/jpeg',
        original_name: 'first.jpg',
        uploader: { name: 'Алия' },
        created_at: '2026-10-12T14:30:00',
      },
      {
        mime_type: 'image/jpeg',
        original_name: 'second.jpg',
        uploader: { name: 'Бек' },
        created_at: '2026-10-13T09:05:00',
      },
    ],
  });
  assert.equal(view.viewerTitle.value, 'Алия');
  assert.equal(view.viewerSubtitle.value, '12.10.2026, 14:30');
  view.selectedIndex.value = 1;
  assert.equal(view.viewerTitle.value, 'Бек');
  assert.equal(view.viewerSubtitle.value, '13.10.2026, 09:05');
});

test('dialog media uses message sender and sending time, hiding missing or invalid dates', () => {
  const view = viewer(false, 1, true, {
    senderName: 'Вы',
    sentAt: '2026-10-12T14:30:00',
    items: [
      { mime_type: 'image/jpeg', original_name: 'photo.jpg', created_at: '2026-10-12T14:31:00' },
    ],
  });
  assert.equal(view.viewerTitle.value, 'Вы');
  assert.equal(view.viewerSubtitle.value, '12.10.2026, 14:30');
  for (const created_at of [undefined, 'invalid']) {
    const missing = viewer(false, 1, true, {
      items: [{ mime_type: 'image/jpeg', original_name: 'photo.jpg', created_at }],
    });
    assert.equal(missing.viewerSubtitle.value, '');
  }
});

test('file mode keeps filenames for unsent previews', () => {
  const view = viewer(false, 1, true, {
    titleMode: 'file',
    items: [{ mime_type: 'image/jpeg', original_name: 'draft.jpg' }],
  });
  assert.equal(view.viewerTitle.value, 'draft.jpg');
  assert.equal(view.viewerSubtitle.value, 'draft.jpg');
});
