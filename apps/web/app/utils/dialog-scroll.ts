export type DialogMessageScrollBlock = ScrollLogicalPosition | 'screen-center';
export type DialogListUpdateMode = 'preserve' | 'follow-instant' | 'follow-smooth';

type DialogAnchorScrollOptions = {
  scrollTop: number;
  previousOffset: number;
  nextOffset: number;
};

type DialogBottomDistanceOptions = {
  scrollHeight: number;
  scrollTop: number;
  clientHeight: number;
  threshold: number;
};

type DialogListUpdateModeOptions = {
  wasAtBottom: boolean;
  previousIds: string[];
  nextIds: string[];
  preserveViewport?: boolean;
};

export type DialogViewportAnchor = {
  id: string;
  offset: number;
};

export type DialogViewportSnapshot = {
  anchors: DialogViewportAnchor[];
  scrollTop: number;
  wasAtBottom: boolean;
};

type DialogMessageScrollOptions = {
  block: DialogMessageScrollBlock;
  viewportHeight: number;
  topInset: number;
  bottomInset: number;
  targetTop: number;
  targetHeight: number;
};

export const getDialogAnchorScrollTop = ({
  scrollTop,
  previousOffset,
  nextOffset,
}: DialogAnchorScrollOptions) => scrollTop + nextOffset - previousOffset;

export const isDialogNearBottom = ({
  scrollHeight,
  scrollTop,
  clientHeight,
  threshold,
}: DialogBottomDistanceOptions) => scrollHeight - scrollTop - clientHeight <= threshold;

export const selectDialogViewportAnchor = (
  anchors: DialogViewportAnchor[],
  availableIds: string[],
): DialogViewportAnchor | null => {
  const availableIdSet = new Set(availableIds);

  return anchors.find((anchor) => availableIdSet.has(anchor.id)) ?? null;
};

export const getDialogListUpdateMode = ({
  wasAtBottom,
  previousIds,
  nextIds,
  preserveViewport = false,
}: DialogListUpdateModeOptions): DialogListUpdateMode => {
  if (preserveViewport || !wasAtBottom) {
    return 'preserve';
  }

  const previousLastId = previousIds.at(-1);
  const nextLastId = nextIds.at(-1);
  const hasNewTail = Boolean(
    nextLastId && nextLastId !== previousLastId && !previousIds.includes(nextLastId),
  );

  return hasNewTail ? 'follow-smooth' : 'follow-instant';
};

export const getDialogMessageScrollTop = ({
  block,
  viewportHeight,
  topInset,
  bottomInset,
  targetTop,
  targetHeight,
}: DialogMessageScrollOptions) => {
  const visibleHeight = Math.max(0, viewportHeight - topInset - bottomInset);

  if (block === 'screen-center') {
    return targetTop - topInset - visibleHeight / 2;
  }

  if (block === 'start') {
    return targetTop - topInset;
  }

  if (block === 'end') {
    return targetTop - viewportHeight + bottomInset + targetHeight;
  }

  return targetTop - topInset - (visibleHeight - targetHeight) / 2;
};
