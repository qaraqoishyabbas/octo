import assert from 'node:assert/strict';
import test from 'node:test';

type DialogScrollModule = {
  getDialogAnchorScrollTop?: (options: {
    scrollTop: number;
    previousOffset: number;
    nextOffset: number;
  }) => number;
  getDialogListUpdateMode?: (options: {
    wasAtBottom: boolean;
    previousIds: string[];
    nextIds: string[];
    preserveViewport?: boolean;
  }) => 'preserve' | 'follow-instant' | 'follow-smooth';
  getDialogMessageScrollTop?: (options: {
    block: ScrollLogicalPosition | 'screen-center';
    viewportHeight: number;
    topInset: number;
    bottomInset: number;
    targetTop: number;
    targetHeight: number;
  }) => number;
  isDialogNearBottom?: (options: {
    scrollHeight: number;
    scrollTop: number;
    clientHeight: number;
    threshold: number;
  }) => boolean;
  selectDialogViewportAnchor?: (
    anchors: Array<{ id: string; offset: number }>,
    availableIds: string[],
  ) => { id: string; offset: number } | null;
};

const loadDialogScrollModule = async (): Promise<DialogScrollModule> =>
  import('../app/utils/dialog-scroll.ts').catch(() => ({}));

test('aligns messages inside the viewport left by sticky dialog controls', async () => {
  const dialogScroll = await loadDialogScrollModule();
  assert.equal(typeof dialogScroll.getDialogMessageScrollTop, 'function');

  const align = (block: ScrollLogicalPosition | 'screen-center') =>
    dialogScroll.getDialogMessageScrollTop!({
      block,
      viewportHeight: 700,
      topInset: 60,
      bottomInset: 140,
      targetTop: 2000,
      targetHeight: 90,
    });

  assert.equal(align('start'), 1940);
  assert.equal(align('end'), 1530);
  assert.equal(align('center'), 1735);
  assert.equal(align('screen-center'), 1690);
});

test('preserves the previous alignment when sticky controls have no height', async () => {
  const dialogScroll = await loadDialogScrollModule();
  assert.equal(typeof dialogScroll.getDialogMessageScrollTop, 'function');

  assert.equal(
    dialogScroll.getDialogMessageScrollTop!({
      block: 'end',
      viewportHeight: 700,
      topInset: 0,
      bottomInset: 0,
      targetTop: 2000,
      targetHeight: 90,
    }),
    1390,
  );
});

test('restores the same message offset after content changes above it', async () => {
  const dialogScroll = await loadDialogScrollModule();
  assert.equal(typeof dialogScroll.getDialogAnchorScrollTop, 'function');

  assert.equal(
    dialogScroll.getDialogAnchorScrollTop!({
      scrollTop: 700,
      previousOffset: 18,
      nextOffset: 166,
    }),
    848,
  );
});

test('detects the bottom using the configured follow threshold', async () => {
  const dialogScroll = await loadDialogScrollModule();
  assert.equal(typeof dialogScroll.isDialogNearBottom, 'function');

  const isNearBottom = (scrollTop: number) =>
    dialogScroll.isDialogNearBottom!({
      scrollHeight: 1200,
      scrollTop,
      clientHeight: 500,
      threshold: 96,
    });

  assert.equal(isNearBottom(604), true);
  assert.equal(isNearBottom(603), false);
});

test('chooses smooth follow only for a new tail while the viewport is bottom-locked', async () => {
  const dialogScroll = await loadDialogScrollModule();
  assert.equal(typeof dialogScroll.getDialogListUpdateMode, 'function');

  const choose = (
    wasAtBottom: boolean,
    previousIds: string[],
    nextIds: string[],
    preserveViewport = false,
  ) =>
    dialogScroll.getDialogListUpdateMode!({
      wasAtBottom,
      previousIds,
      nextIds,
      preserveViewport,
    });

  assert.equal(choose(true, ['1', '2'], ['1', '2', '3']), 'follow-smooth');
  assert.equal(choose(true, ['1', '2'], ['2', '3']), 'follow-smooth');
  assert.equal(choose(true, ['1', '2'], ['8', '9']), 'follow-smooth');
  assert.equal(choose(true, ['1', '2'], ['1', '2']), 'follow-instant');
  assert.equal(choose(false, ['1', '2'], ['1', '2', '3']), 'preserve');
  assert.equal(choose(false, ['1', '2'], ['8', '9']), 'preserve');
  assert.equal(choose(true, ['1', '2'], ['1', '2', '3'], true), 'preserve');
});

test('selects the next surviving viewport anchor in candidate order', async () => {
  const dialogScroll = await loadDialogScrollModule();
  assert.equal(typeof dialogScroll.selectDialogViewportAnchor, 'function');

  const anchors = [
    { id: 'current', offset: 12 },
    { id: 'next', offset: 86 },
    { id: 'earlier', offset: -40 },
  ];

  assert.deepEqual(dialogScroll.selectDialogViewportAnchor!(anchors, ['next', 'earlier']), {
    id: 'next',
    offset: 86,
  });
  assert.deepEqual(dialogScroll.selectDialogViewportAnchor!(anchors, ['earlier']), {
    id: 'earlier',
    offset: -40,
  });
  assert.equal(dialogScroll.selectDialogViewportAnchor!(anchors, ['other']), null);
});
