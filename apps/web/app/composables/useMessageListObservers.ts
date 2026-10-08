import { onMounted, onScopeDispose, toValue, type MaybeRefOrGetter, type Ref } from 'vue';
import type { ChatMessage } from '~/types';
import { getLastVisibleUnreadMessageId } from '../utils/message-list-visibility.ts';

type MessageListObserverOptions = {
  container: Ref<HTMLElement | null>;
  olderSentinel: Ref<HTMLElement | null>;
  newerSentinel: Ref<HTMLElement | null>;
  messages: MaybeRefOrGetter<ChatMessage[]>;
  lastReadAt: MaybeRefOrGetter<string | null | undefined>;
  rootMargin?: MaybeRefOrGetter<string | undefined>;
  resizeElements?: () => Array<HTMLElement | null | undefined>;
  onLoadOlder: () => void | Promise<void>;
  onLoadNewer: () => void | Promise<void>;
  onReadUntil: (messageId: string) => void | Promise<void>;
  onResize: () => void;
};

export function useMessageListObservers(options: MessageListObserverOptions) {
  const messageElements = new Set<HTMLElement>();
  const visibleMessageIds = new Set<string>();
  let sentinelObserver: IntersectionObserver | null = null;
  let messageObserver: IntersectionObserver | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let readFrame: number | null = null;
  let resizeFrame: number | null = null;
  let olderHistoryDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  let newerHistoryDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingReadId: string | null = null;
  let disposed = false;

  const queueHistoryLoad = (direction: 'older' | 'newer') => {
    const activeTimer =
      direction === 'older' ? olderHistoryDebounceTimer : newerHistoryDebounceTimer;
    if (activeTimer) {
      clearTimeout(activeTimer);
    }

    const timer = setTimeout(() => {
      if (direction === 'older') {
        olderHistoryDebounceTimer = null;
      } else {
        newerHistoryDebounceTimer = null;
      }
      if (disposed) {
        return;
      }

      void (direction === 'older' ? options.onLoadOlder() : options.onLoadNewer());
    }, 50);

    if (direction === 'older') {
      olderHistoryDebounceTimer = timer;
    } else {
      newerHistoryDebounceTimer = timer;
    }
  };

  const runReadCheck = () => {
    const messageId = getLastVisibleUnreadMessageId({
      messages: toValue(options.messages),
      visibleIds: [...visibleMessageIds],
      lastReadAt: toValue(options.lastReadAt),
      pendingId: pendingReadId,
      documentHidden: typeof document !== 'undefined' && document.hidden,
    });

    if (!messageId) {
      return;
    }

    pendingReadId = messageId;
    void options.onReadUntil(messageId);
  };

  const queueReadCheck = () => {
    if (typeof window === 'undefined' || disposed) {
      return;
    }

    if (readFrame !== null) {
      window.cancelAnimationFrame(readFrame);
    }

    readFrame = window.requestAnimationFrame(() => {
      readFrame = null;
      runReadCheck();
    });
  };

  const handleResize = () => {
    if (typeof window === 'undefined' || resizeFrame !== null) {
      return;
    }

    resizeFrame = window.requestAnimationFrame(() => {
      resizeFrame = null;
      if (!disposed) {
        options.onResize();
      }
    });
  };

  const observeMessage = (element: HTMLElement | null) => {
    if (!element) {
      return;
    }

    messageElements.add(element);
    messageObserver?.observe(element);
    resizeObserver?.observe(element);
  };

  const unobserveMessage = (element: HTMLElement | null) => {
    if (!element) {
      return;
    }

    const messageId = element.dataset.messageId;
    if (messageId) {
      visibleMessageIds.delete(messageId);
    }
    messageElements.delete(element);
    messageObserver?.unobserve(element);
    resizeObserver?.unobserve(element);
  };

  const disconnect = () => {
    sentinelObserver?.disconnect();
    messageObserver?.disconnect();
    resizeObserver?.disconnect();
    sentinelObserver = null;
    messageObserver = null;
    resizeObserver = null;
    visibleMessageIds.clear();
  };

  const reconnect = () => {
    disconnect();

    const container = options.container.value;
    if (
      !container ||
      typeof IntersectionObserver === 'undefined' ||
      typeof ResizeObserver === 'undefined'
    ) {
      return;
    }

    sentinelObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          if (entry.target === options.olderSentinel.value) {
            queueHistoryLoad('older');
          } else if (entry.target === options.newerSentinel.value) {
            queueHistoryLoad('newer');
          }
        });
      },
      {
        root: container,
        rootMargin: toValue(options.rootMargin) ?? '0px',
        threshold: 0.1,
      },
    );

    messageObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const messageId = (entry.target as HTMLElement).dataset.messageId;
          if (!messageId) {
            return;
          }

          if (entry.isIntersecting) {
            visibleMessageIds.add(messageId);
          } else {
            visibleMessageIds.delete(messageId);
          }
        });
        queueReadCheck();
      },
      { root: container, rootMargin: toValue(options.rootMargin) ?? '0px', threshold: 0.01 },
    );

    resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);
    options.resizeElements?.().forEach((element) => {
      if (element) {
        resizeObserver?.observe(element);
      }
    });

    if (options.olderSentinel.value) {
      sentinelObserver.observe(options.olderSentinel.value);
    }
    if (options.newerSentinel.value) {
      sentinelObserver.observe(options.newerSentinel.value);
    }

    messageElements.forEach((element) => {
      if (!container.contains(element)) {
        messageElements.delete(element);
        return;
      }
      messageObserver?.observe(element);
      resizeObserver?.observe(element);
    });

    container.querySelectorAll<HTMLElement>('[data-message-id]').forEach(observeMessage);
    queueReadCheck();
  };

  const handleVisibilityChange = () => {
    if (!document.hidden) {
      queueReadCheck();
    }
  };

  onMounted(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    reconnect();
  });

  onScopeDispose(() => {
    disposed = true;
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
    disconnect();

    if (typeof window !== 'undefined' && readFrame !== null) {
      window.cancelAnimationFrame(readFrame);
    }
    if (typeof window !== 'undefined' && resizeFrame !== null) {
      window.cancelAnimationFrame(resizeFrame);
    }
    if (olderHistoryDebounceTimer) {
      clearTimeout(olderHistoryDebounceTimer);
    }
    if (newerHistoryDebounceTimer) {
      clearTimeout(newerHistoryDebounceTimer);
    }
  });

  return {
    observeMessage,
    unobserveMessage,
    queueReadCheck,
    reconnect,
  };
}
