import { nextTick, onMounted, onScopeDispose, readonly, ref, type Ref } from 'vue';
import type { MessageScrollIntent } from '../stores/messages.ts';
import {
  getDialogAnchorScrollTop,
  getDialogMessageScrollTop,
  isDialogNearBottom,
  selectDialogViewportAnchor,
  type DialogListUpdateMode,
  type DialogViewportSnapshot,
} from '../utils/dialog-scroll.ts';

const BOTTOM_THRESHOLD_PX = 96;
const SMOOTH_SCROLL_FALLBACK_MS = 1000;

type ProgrammaticScrollTarget = 'bottom' | 'message';

export type MessageListReconcileOptions = {
  snapshot: DialogViewportSnapshot | null;
  updateMode: DialogListUpdateMode;
};

type MessageListScrollOptions = {
  container: Ref<HTMLElement | null>;
  content: Ref<HTMLElement | null>;
  onQueueReadCheck: () => void;
};

export function useMessageListScroll(options: MessageListScrollOptions) {
  const highlightedMessageId = ref<string | null>(null);
  let scrollElement: HTMLElement | null = null;
  let activeProgrammaticScroll: ProgrammaticScrollTarget | null = null;
  let bottomLocked = true;
  let prefersReducedMotion = false;
  let stableSnapshot: DialogViewportSnapshot | null = null;
  let smoothScrollTimer: ReturnType<typeof setTimeout> | null = null;
  let highlightTimer: ReturnType<typeof setTimeout> | null = null;
  let snapshotFrame: number | null = null;
  let resizeFrame: number | null = null;

  const queueReadCheck = () => options.onQueueReadCheck();

  const getViewport = () => {
    const container = options.container.value;
    if (!container) {
      return null;
    }

    const containerRect = container.getBoundingClientRect();
    const applicationBarRect = container
      .querySelector<HTMLElement>('[data-dialog-application-bar]')
      ?.getBoundingClientRect();
    const textareaRect = container
      .querySelector<HTMLElement>('[data-dialog-textarea]')
      ?.getBoundingClientRect();
    const topInset = Math.min(
      containerRect.height,
      Math.max(0, (applicationBarRect?.bottom ?? containerRect.top) - containerRect.top),
    );
    const bottomInset = Math.min(
      containerRect.height,
      Math.max(0, containerRect.bottom - (textareaRect?.top ?? containerRect.bottom)),
    );

    return {
      containerRect,
      topInset,
      bottomInset,
      visibleTop: containerRect.top + topInset,
      visibleBottom: containerRect.bottom - bottomInset,
    };
  };

  const isNearBottom = () => {
    const container = options.container.value;
    return container
      ? isDialogNearBottom({
          scrollHeight: container.scrollHeight,
          scrollTop: container.scrollTop,
          clientHeight: container.clientHeight,
          threshold: BOTTOM_THRESHOLD_PX,
        })
      : true;
  };

  const captureSnapshot = (): DialogViewportSnapshot | null => {
    const container = options.container.value;
    const content = options.content.value;
    const viewport = getViewport();
    if (!container || !content || !viewport) {
      return null;
    }

    const anchors = [...content.querySelectorAll<HTMLElement>('[data-message-id]')]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.bottom > viewport.visibleTop && rect.top < viewport.visibleBottom;
      })
      .flatMap((element) => {
        const id = element.dataset.messageId;
        return id
          ? [{ id, offset: element.getBoundingClientRect().top - viewport.visibleTop }]
          : [];
      });

    return {
      anchors,
      scrollTop: container.scrollTop,
      wasAtBottom: isNearBottom(),
    };
  };

  const queueStableSnapshot = () => {
    if (typeof window === 'undefined' || snapshotFrame !== null) {
      return;
    }

    snapshotFrame = window.requestAnimationFrame(() => {
      snapshotFrame = null;
      stableSnapshot = captureSnapshot();
    });
  };

  const finishProgrammaticScroll = () => {
    if (smoothScrollTimer) {
      clearTimeout(smoothScrollTimer);
      smoothScrollTimer = null;
    }
    activeProgrammaticScroll = null;
    bottomLocked = isNearBottom();
    stableSnapshot = captureSnapshot();
    queueReadCheck();
  };

  const scrollToPosition = (
    top: number,
    behavior: ScrollBehavior,
    target: ProgrammaticScrollTarget,
  ) => {
    const container = options.container.value;
    if (!container) {
      return;
    }

    const resolvedBehavior = behavior === 'smooth' && !prefersReducedMotion ? 'smooth' : 'auto';
    const maximumScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
    const boundedTop = Math.min(maximumScrollTop, Math.max(0, top));

    if (smoothScrollTimer) {
      clearTimeout(smoothScrollTimer);
      smoothScrollTimer = null;
    }

    if (resolvedBehavior === 'smooth') {
      activeProgrammaticScroll = target;
      bottomLocked = target === 'bottom' || maximumScrollTop - boundedTop <= BOTTOM_THRESHOLD_PX;
      smoothScrollTimer = setTimeout(finishProgrammaticScroll, SMOOTH_SCROLL_FALLBACK_MS);
    } else {
      activeProgrammaticScroll = null;
    }

    container.scrollTo({ top: boundedTop, behavior: resolvedBehavior });

    if (resolvedBehavior === 'auto') {
      bottomLocked = isNearBottom();
      stableSnapshot = captureSnapshot();
      queueReadCheck();
    }
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'auto') => {
    const container = options.container.value;
    if (container) {
      scrollToPosition(container.scrollHeight, behavior, 'bottom');
    }
  };

  const findMessageElement = (messageId: string) =>
    [...(options.content.value?.querySelectorAll<HTMLElement>('[data-message-id]') ?? [])].find(
      (element) => element.dataset.messageId === messageId,
    ) ?? null;

  const restoreSnapshot = (snapshot: DialogViewportSnapshot | null) => {
    const container = options.container.value;
    const content = options.content.value;
    const viewport = getViewport();
    if (!container || !content || !viewport || !snapshot) {
      return;
    }

    const availableIds = [...content.querySelectorAll<HTMLElement>('[data-message-id]')].flatMap(
      (element) => (element.dataset.messageId ? [element.dataset.messageId] : []),
    );
    const anchor = selectDialogViewportAnchor(snapshot.anchors, availableIds);
    const element = anchor ? findMessageElement(anchor.id) : null;

    if (anchor && element) {
      const nextOffset = element.getBoundingClientRect().top - viewport.visibleTop;
      scrollToPosition(
        getDialogAnchorScrollTop({
          scrollTop: container.scrollTop,
          previousOffset: anchor.offset,
          nextOffset,
        }),
        'auto',
        'message',
      );
      return;
    }

    scrollToPosition(snapshot.scrollTop, 'auto', 'message');
  };

  const scrollToIntent = async (intent: MessageScrollIntent) => {
    const container = options.container.value;
    if (!container) {
      return false;
    }

    await nextTick();
    const target = findMessageElement(intent.messageId);
    const viewport = getViewport();
    if (!target || !viewport) {
      return false;
    }

    const targetRect = target.getBoundingClientRect();
    const targetTop = container.scrollTop + targetRect.top - viewport.containerRect.top;
    scrollToPosition(
      getDialogMessageScrollTop({
        block: intent.block,
        viewportHeight: container.clientHeight,
        topInset: viewport.topInset,
        bottomInset: viewport.bottomInset,
        targetTop,
        targetHeight: targetRect.height,
      }),
      intent.behavior,
      'message',
    );

    if (highlightTimer) {
      clearTimeout(highlightTimer);
      highlightTimer = null;
    }
    highlightedMessageId.value = intent.highlight ? intent.messageId : null;
    if (intent.highlight) {
      highlightTimer = setTimeout(() => {
        highlightedMessageId.value = null;
        highlightTimer = null;
      }, 1000);
    }

    return true;
  };

  const reconcileAfterRender = async ({ snapshot, updateMode }: MessageListReconcileOptions) => {
    await nextTick();

    if (updateMode === 'follow-smooth') {
      scrollToBottom('smooth');
    } else if (updateMode === 'follow-instant') {
      scrollToBottom('auto');
    } else {
      restoreSnapshot(snapshot ?? stableSnapshot);
    }

    stableSnapshot = captureSnapshot();
    queueReadCheck();
  };

  const handleResize = () => {
    if (typeof window === 'undefined' || resizeFrame !== null) {
      return;
    }

    const snapshot = stableSnapshot;
    resizeFrame = window.requestAnimationFrame(() => {
      resizeFrame = null;
      // Reconnecting observers also emits resize notifications. Restoring the
      // old viewport here would cancel an explicit smooth jump to a message.
      if (activeProgrammaticScroll === 'message') {
        return;
      }
      if (bottomLocked) {
        scrollToBottom('auto');
      } else {
        restoreSnapshot(snapshot);
      }
      stableSnapshot = captureSnapshot();
    });
  };

  const handleScroll = () => {
    if (!activeProgrammaticScroll) {
      bottomLocked = isNearBottom();
      queueStableSnapshot();
    }
    queueReadCheck();
  };

  const handleScrollEnd = () => {
    if (activeProgrammaticScroll) {
      finishProgrammaticScroll();
      return;
    }
    bottomLocked = isNearBottom();
    stableSnapshot = captureSnapshot();
    queueReadCheck();
  };

  const cancelProgrammaticScroll = () => {
    const container = options.container.value;
    if (!container || !activeProgrammaticScroll) {
      return;
    }

    activeProgrammaticScroll = null;
    if (smoothScrollTimer) {
      clearTimeout(smoothScrollTimer);
      smoothScrollTimer = null;
    }
    container.scrollTo({ top: container.scrollTop, behavior: 'auto' });
    bottomLocked = isNearBottom();
    stableSnapshot = captureSnapshot();
  };

  onMounted(async () => {
    await nextTick();
    scrollElement = options.container.value;
    prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    scrollElement?.addEventListener('scroll', handleScroll, { passive: true });
    scrollElement?.addEventListener('scrollend', handleScrollEnd, { passive: true });
    scrollElement?.addEventListener('wheel', cancelProgrammaticScroll, { passive: true });
    scrollElement?.addEventListener('touchstart', cancelProgrammaticScroll, { passive: true });
    scrollElement?.addEventListener('pointerdown', cancelProgrammaticScroll, { passive: true });
    bottomLocked = isNearBottom();
    stableSnapshot = captureSnapshot();
  });

  onScopeDispose(() => {
    scrollElement?.removeEventListener('scroll', handleScroll);
    scrollElement?.removeEventListener('scrollend', handleScrollEnd);
    scrollElement?.removeEventListener('wheel', cancelProgrammaticScroll);
    scrollElement?.removeEventListener('touchstart', cancelProgrammaticScroll);
    scrollElement?.removeEventListener('pointerdown', cancelProgrammaticScroll);

    if (smoothScrollTimer) {
      clearTimeout(smoothScrollTimer);
    }
    if (highlightTimer) {
      clearTimeout(highlightTimer);
    }
    if (typeof window !== 'undefined' && snapshotFrame !== null) {
      window.cancelAnimationFrame(snapshotFrame);
    }
    if (typeof window !== 'undefined' && resizeFrame !== null) {
      window.cancelAnimationFrame(resizeFrame);
    }
  });

  return {
    highlightedMessageId: readonly(highlightedMessageId),
    captureSnapshot,
    reconcileAfterRender,
    handleResize,
    scrollToBottom,
    scrollToIntent,
    queueReadCheck,
  };
}

export type MessageListScrollController = ReturnType<typeof useMessageListScroll>;
