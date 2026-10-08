import { nextTick } from 'vue';
import type { MessageScrollIntent } from '../stores/messages.ts';
import { getDialogListUpdateMode } from '../utils/dialog-scroll.ts';
import type { MessageListScrollController } from './useMessageListScroll.ts';

type MessageHistoryStore = {
  list: Array<{ id: string }>;
  loading: boolean;
  olderLoading: boolean;
  newerLoading: boolean;
  olderCursor: string | null;
  newerCursor: string | null;
  scrollIntent: MessageScrollIntent | null;
  loadOlder: () => Promise<void>;
  loadNewer: () => Promise<void>;
  retryOlder: () => Promise<void>;
  retryNewer: () => Promise<void>;
  consumeScrollIntent: (messageId: string) => void;
};

type MessageListHistoryOptions = {
  messages: MessageHistoryStore;
  scroll: MessageListScrollController;
};

export function useMessageListHistory({ messages, scroll }: MessageListHistoryOptions) {
  const reconcile = async (
    snapshot: ReturnType<MessageListScrollController['captureSnapshot']>,
    previousIds: string[],
    preserveViewport: boolean,
  ) => {
    await nextTick();
    const intent = messages.scrollIntent;
    if (intent && (await scroll.scrollToIntent(intent))) {
      messages.consumeScrollIntent(intent.messageId);
      scroll.queueReadCheck();
      return;
    }

    await scroll.reconcileAfterRender({
      snapshot,
      updateMode: getDialogListUpdateMode({
        wasAtBottom: snapshot?.wasAtBottom ?? true,
        previousIds,
        nextIds: messages.list.map(({ id }) => id),
        preserveViewport,
      }),
    });
  };

  const loadOlder = async () => {
    if (messages.loading || messages.olderLoading || !messages.olderCursor) {
      return;
    }

    const snapshot = scroll.captureSnapshot();
    const previousIds = messages.list.map(({ id }) => id);
    await messages.loadOlder();
    await reconcile(snapshot, previousIds, true);
  };

  const loadNewer = async () => {
    if (messages.loading || messages.newerLoading || !messages.newerCursor) {
      return;
    }

    const snapshot = scroll.captureSnapshot();
    const previousIds = messages.list.map(({ id }) => id);
    await messages.loadNewer();
    await reconcile(snapshot, previousIds, true);
  };

  const retryOlder = async () => {
    const snapshot = scroll.captureSnapshot();
    const previousIds = messages.list.map(({ id }) => id);
    await messages.retryOlder();
    await reconcile(snapshot, previousIds, true);
  };

  const retryNewer = async () => {
    const snapshot = scroll.captureSnapshot();
    const previousIds = messages.list.map(({ id }) => id);
    await messages.retryNewer();
    await reconcile(snapshot, previousIds, true);
  };

  const reconcileCurrentWindow = async (previousIds: string[] = []) => {
    const snapshot = scroll.captureSnapshot();
    await reconcile(snapshot, previousIds, false);
  };

  return {
    loadOlder,
    loadNewer,
    retryOlder,
    retryNewer,
    reconcileCurrentWindow,
  };
}
