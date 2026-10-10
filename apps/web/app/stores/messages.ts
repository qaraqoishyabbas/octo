import { defineStore } from 'pinia';
import { computed } from 'vue';
import type { ChatMessage } from '~/types';
import {
  mergeMessageWindow,
  reconcileCreatedMessage,
  reconcileDeletedMessage,
  reconcileUpdatedMessage,
  type MessageLoadDirection,
  type MessagesPage,
} from '../utils/message-window.ts';

type MessageStoreResponse = {
  ok: boolean;
  data: ChatMessage;
};

type MessageUpdateResponse = MessageStoreResponse;

type MessagePinResponse = MessageStoreResponse & {
  pinned: boolean;
};

type PinnedMessagesResponse = {
  ok: boolean;
  data: ChatMessage[];
  total: number;
};

type MessageDestroyResponse = {
  ok: boolean;
};

type MessageScrollBlock = ScrollLogicalPosition | 'screen-center';
type MessageScrollBehavior = ScrollBehavior;
type HistoryRequest = {
  direction: MessageLoadDirection;
  cursor?: string | null;
  cursorId?: string | null;
};

type ActiveHistoryRequest = {
  controller: AbortController;
  dialogId: string;
  key: string;
  sequence: number;
};

export type MessageScrollIntent = {
  messageId: string;
  highlight: boolean;
  block: MessageScrollBlock;
  behavior: MessageScrollBehavior;
};

const MAX_MESSAGES = 60;

export const useMessagesStore = defineStore('messages', () => {
  const dialog = useDialogStore();
  const dialogs = useDialogsStore();
  const activeHistoryRequests = new Map<MessageLoadDirection, ActiveHistoryRequest>();
  const lastHistoryRequests = new Map<MessageLoadDirection, HistoryRequest>();
  let readFlushTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingReadMessageId: string | null = null;
  let readRequestInFlight = false;

  const list = ref<ChatMessage[]>([]);
  const initialLoading = ref(true);
  const initialError = ref(false);
  const loading = initialLoading;
  const error = initialError;
  const sending = ref(false);
  const editingMessageIds = ref<string[]>([]);
  const deletingMessageIds = ref<string[]>([]);
  const pinningMessageIds = ref<string[]>([]);
  const editingMessage = ref<ChatMessage | null>(null);
  const replyMessage = ref<ChatMessage | null>(null);
  const pinnedList = ref<ChatMessage[]>([]);
  const latestPinnedMessage = computed(() => {
    const dialogId = dialog.current?.dialog_id;
    if (!dialogId) return null;
    const internalDialogId = dialog.current?.id;
    return pinnedList.value.reduce<ChatMessage | null>((latest, message) => {
      if (
        (message.dialog_id !== internalDialogId && message.dialog_id !== dialogId) ||
        message.is_pinned === false
      )
        return latest;
      if (!latest) return message;
      const time = Date.parse(message.pinned_at ?? '') || 0;
      const latestTime = Date.parse(latest.pinned_at ?? '') || 0;
      return time > latestTime || (time === latestTime && message.id > latest.id)
        ? message
        : latest;
    }, null);
  });
  const pinnedLoading = ref(false);
  const pinnedError = ref(false);
  let pinnedRequestSequence = 0;
  const requestSequence = ref(0);

  const olderCursor = ref<string | null>(null);
  const newerCursor = ref<string | null>(null);
  const olderLoading = ref(false);
  const newerLoading = ref(false);
  const olderError = ref(false);
  const newerError = ref(false);
  const scrollIntent = ref<MessageScrollIntent | null>(null);
  const unreadBoundaryMessageId = ref<string | null>(null);
  const searchHighlightQuery = ref('');

  const cleanQueryParams = (params: Record<string, string | null | undefined>) =>
    Object.fromEntries(
      Object.entries(params).filter(
        ([, value]) => value !== null && value !== undefined && value !== '',
      ),
    );

  const applyWindow = (window: {
    list: ChatMessage[];
    olderCursor: string | null;
    newerCursor: string | null;
  }) => {
    list.value = window.list;
    olderCursor.value = window.olderCursor;
    newerCursor.value = window.newerCursor;
  };

  const getWindow = () => ({
    list: list.value,
    olderCursor: olderCursor.value,
    newerCursor: newerCursor.value,
  });

  const getHistoryLoading = (direction: MessageLoadDirection) => {
    if (direction === 'older') {
      return olderLoading;
    }
    if (direction === 'newer') {
      return newerLoading;
    }
    return initialLoading;
  };

  const getHistoryError = (direction: MessageLoadDirection) => {
    if (direction === 'older') {
      return olderError;
    }
    if (direction === 'newer') {
      return newerError;
    }
    return initialError;
  };

  const loadHistory = async (request: HistoryRequest) => {
    const dialogId = dialog.current?.dialog_id;
    if (!dialogId) {
      getHistoryLoading(request.direction).value = false;
      return;
    }

    const effectiveRequest = { ...request };
    const firstUnreadMessageId =
      (dialog.current?.counter ?? 0) > 0 ? dialog.current?.first_unread_message_id : null;

    if (
      request.direction === 'initial' &&
      !effectiveRequest.cursor &&
      !effectiveRequest.cursorId &&
      firstUnreadMessageId
    ) {
      effectiveRequest.cursorId = firstUnreadMessageId;
      unreadBoundaryMessageId.value = firstUnreadMessageId;
      scrollToMessage(firstUnreadMessageId, false, 'screen-center', 'auto');
    }

    const cleanRequestQuery = cleanQueryParams({
      dialog_id: dialogId,
      cursor_id: effectiveRequest.cursorId,
      cursor: effectiveRequest.cursor,
    });
    const requestKey = JSON.stringify(cleanRequestQuery);
    const activeRequest = activeHistoryRequests.get(request.direction);

    if (activeRequest?.key === requestKey) {
      return;
    }

    activeRequest?.controller.abort();
    const controller = new AbortController();
    const sequence = requestSequence.value;
    const requestRecord = { controller, dialogId, key: requestKey, sequence };
    activeHistoryRequests.set(request.direction, requestRecord);
    lastHistoryRequests.set(request.direction, effectiveRequest);
    getHistoryLoading(request.direction).value = true;
    getHistoryError(request.direction).value = false;

    try {
      const data = await $http<MessagesPage>('messages', {
        query: cleanRequestQuery,
        signal: controller.signal,
      });

      if (
        sequence !== requestSequence.value ||
        dialog.current?.dialog_id !== dialogId ||
        activeHistoryRequests.get(request.direction) !== requestRecord
      ) {
        return;
      }

      applyWindow(mergeMessageWindow(getWindow(), data, request.direction, MAX_MESSAGES));
    } catch (e) {
      if (
        sequence !== requestSequence.value ||
        activeHistoryRequests.get(request.direction) !== requestRecord
      ) {
        return;
      }
      if (e instanceof DOMException && e.name === 'AbortError') {
        return;
      }
      getHistoryError(request.direction).value = true;
    } finally {
      if (activeHistoryRequests.get(request.direction) === requestRecord) {
        activeHistoryRequests.delete(request.direction);
        getHistoryLoading(request.direction).value = false;
      }
    }
  };

  const loadInitial = async (options: { cursorId?: string | null } = {}) =>
    loadHistory({ direction: 'initial', cursorId: options.cursorId });

  const retryInitial = async () =>
    loadHistory(lastHistoryRequests.get('initial') ?? { direction: 'initial' });

  const appendMessage = (message: ChatMessage) => {
    if (list.value.some((item) => item.id === message.id)) {
      scrollToMessage(message.id, false, 'end');
      return;
    }

    if (newerCursor.value) {
      // Keep the history window intact; its newer cursor will load the sent
      // message in chronological order when the user reaches the latest page.
      return;
    }

    const nextWindow = reconcileCreatedMessage(getWindow(), message, MAX_MESSAGES);
    list.value.push(message);
    const overflow = list.value.length - MAX_MESSAGES;
    if (overflow > 0) list.value.splice(0, overflow);
    olderCursor.value = nextWindow.olderCursor;
    scrollToMessage(message.id, false, 'end');
  };

  const receiveMessage = async (message: ChatMessage, shouldScroll = false) => {
    const existingIndex = list.value.findIndex((item) => item.id === message.id);

    if (existingIndex !== -1) {
      list.value[existingIndex] = message;
      return;
    }

    if (newerCursor.value) {
      return;
    }

    applyWindow(reconcileCreatedMessage(getWindow(), message, MAX_MESSAGES));
    if (shouldScroll) {
      scrollToMessage(message.id, false, 'end');
    }
  };

  const receiveMessageUpdate = (message: ChatMessage) => {
    const reconciled = reconcileUpdatedMessage(
      {
        window: getWindow(),
        pinnedList: pinnedList.value,
        editingMessage: editingMessage.value,
        replyMessage: replyMessage.value,
        dialogMessage: dialog.current?.message ?? null,
      },
      message,
    );

    applyWindow(reconciled.window);
    pinnedList.value = reconciled.pinnedList;
    editingMessage.value = reconciled.editingMessage;
    replyMessage.value = reconciled.replyMessage;
    if (dialog.current && reconciled.dialogMessage !== dialog.current.message) {
      dialog.current.message = reconciled.dialogMessage;
    }
  };

  const receiveMessageDeleted = (messageId: string) => {
    const reconciled = reconcileDeletedMessage(
      {
        window: getWindow(),
        pinnedList: pinnedList.value,
        editingMessage: editingMessage.value,
        replyMessage: replyMessage.value,
        dialogMessage: dialog.current?.message ?? null,
      },
      messageId,
    );

    applyWindow(reconciled.window);
    pinnedList.value = reconciled.pinnedList;
    editingMessage.value = reconciled.editingMessage;
    replyMessage.value = reconciled.replyMessage;
    if (dialog.current && reconciled.dialogMessage !== dialog.current.message) {
      dialog.current.message = reconciled.dialogMessage;
    }
  };

  const scrollToMessage = (
    messageId?: string | null,
    highlight = false,
    block: MessageScrollBlock = 'center',
    behavior: MessageScrollBehavior = 'smooth',
  ) => {
    if (!messageId) {
      return;
    }

    scrollIntent.value = {
      messageId,
      highlight,
      block,
      behavior,
    };
  };

  const consumeScrollIntent = (messageId: string) => {
    if (scrollIntent.value?.messageId !== messageId) {
      return;
    }

    scrollIntent.value = null;
  };

  const findMessage = (messageId?: string | null) => {
    if (!messageId) {
      return null;
    }

    return list.value.find((message) => message.id === messageId) ?? null;
  };

  const compareMessages = (leftId?: string | null, rightId?: string | null) => {
    const left = findMessage(leftId);
    const right = findMessage(rightId);

    if (!left || !right) {
      return 0;
    }

    const timeDiff = Date.parse(left.created_at) - Date.parse(right.created_at);
    if (timeDiff !== 0) {
      return timeDiff;
    }

    return list.value.indexOf(left) - list.value.indexOf(right);
  };

  const isReadableMessage = (message: ChatMessage) => {
    if (message.is_sender) {
      return false;
    }

    if (!dialog.current?.last_read_at) {
      return true;
    }

    return Date.parse(message.created_at) > Date.parse(dialog.current.last_read_at);
  };

  const flushReadProgress = async () => {
    if (!pendingReadMessageId) {
      return;
    }

    if (readRequestInFlight) {
      return;
    }

    if (typeof dialog.current?.counter === 'number' && dialog.current.counter <= 0) {
      pendingReadMessageId = null;
      return;
    }

    const dialogId = dialog.current?.dialog_id;
    const messageId = pendingReadMessageId;
    pendingReadMessageId = null;

    if (!dialogId) {
      return;
    }

    readRequestInFlight = true;

    try {
      const data = await dialogs.readUntil(dialogId, messageId);

      if (data?.ok && dialog.current?.dialog_id === dialogId) {
        dialog.current.counter = data.counter ?? 0;
        dialog.current.last_read_at = data.last_read_at ?? null;
        dialog.current.first_unread_message_id = data.first_unread_message_id ?? null;
        if (typeof data.has_reminder === 'boolean') {
          dialog.current.has_reminder = data.has_reminder;
        }
      }
    } finally {
      readRequestInFlight = false;
      if (pendingReadMessageId) {
        readFlushTimer = setTimeout(flushReadProgress, 250);
      }
    }
  };

  const markReadUntil = (messageId?: string | null) => {
    if (typeof dialog.current?.counter === 'number' && dialog.current.counter <= 0) {
      pendingReadMessageId = null;
      return;
    }

    const message = findMessage(messageId);

    if (!message || !isReadableMessage(message)) {
      return;
    }

    if (pendingReadMessageId && compareMessages(message.id, pendingReadMessageId) <= 0) {
      return;
    }

    pendingReadMessageId = message.id;

    if (readFlushTimer) {
      clearTimeout(readFlushTimer);
    }

    readFlushTimer = setTimeout(flushReadProgress, 350);
  };

  const send = async (
    message: string,
    attachments: string[] = [],
    silent = false,
  ): Promise<ChatMessage | null> => {
    const dialogId = dialog.current?.dialog_id;
    const messageText = message.trim();
    const attachmentIds = attachments.filter(Boolean);
    const sentReply = replyMessage.value;

    if (!dialogId || (!messageText && attachmentIds.length === 0) || sending.value) {
      return null;
    }

    sending.value = true;

    try {
      const data = await $http<MessageStoreResponse>('messages', {
        method: 'POST',
        body: {
          dialog_id: dialogId,
          message: messageText,
          silent,
          reply_to_id: sentReply?.id ?? null,
          attachments: attachmentIds,
        },
      });

      const createdMessage = data?.data ?? null;

      if (!createdMessage) {
        return null;
      }

      const currentDialog = dialog.current?.dialog_id === dialogId ? dialog.current : null;

      if (currentDialog) {
        appendMessage(createdMessage);
        if (replyMessage.value === sentReply) replyMessage.value = null;
        if (currentDialog.type === 'D' && createdMessage.dialog_id) {
          currentDialog.id = createdMessage.dialog_id;
        }
        currentDialog.message = createdMessage;
      }

      if (!dialogs.syncMessage(dialogId, createdMessage) && currentDialog) {
        dialogs.replaceDialog({
          ...currentDialog,
          message: createdMessage,
        });
      }

      return createdMessage;
    } finally {
      sending.value = false;
    }
  };

  const remove = async (messageId: string) => {
    if (!messageId || deletingMessageIds.value.includes(messageId)) {
      return false;
    }

    deletingMessageIds.value = [...deletingMessageIds.value, messageId];

    try {
      const data = await $http<MessageDestroyResponse>(
        `messages/${encodeURIComponent(messageId)}`,
        {
          method: 'DELETE',
        },
      );

      if (!data?.ok) {
        return false;
      }

      list.value = list.value.filter((message) => message.id !== messageId);

      if (dialog.current?.dialog_id) {
        await dialogs.refreshById(dialog.current.dialog_id);
      }

      return true;
    } finally {
      deletingMessageIds.value = deletingMessageIds.value.filter((id) => id !== messageId);
    }
  };

  const update = async (messageId: string, message: string) => {
    const messageText = message.trim();

    if (!messageId || editingMessageIds.value.includes(messageId)) {
      return null;
    }

    editingMessageIds.value = [...editingMessageIds.value, messageId];

    try {
      const data = await $http<MessageUpdateResponse>(`messages/${encodeURIComponent(messageId)}`, {
        method: 'PATCH',
        body: {
          message: messageText,
        },
      });
      const updatedMessage = data?.data ?? null;

      if (!updatedMessage) {
        return null;
      }

      list.value = list.value.map((item) =>
        item.id === updatedMessage.id ? updatedMessage : item,
      );

      if (dialog.current?.message?.id === updatedMessage.id) {
        dialog.current.message = updatedMessage;
      }

      if (editingMessage.value?.id === updatedMessage.id) {
        editingMessage.value = null;
      }

      return updatedMessage;
    } finally {
      editingMessageIds.value = editingMessageIds.value.filter((id) => id !== messageId);
    }
  };

  const fetchPinned = async () => {
    const requestId = ++pinnedRequestSequence;
    const dialogId = dialog.current?.dialog_id;

    if (!dialogId) {
      pinnedList.value = [];
      pinnedLoading.value = false;
      pinnedError.value = false;
      return;
    }

    pinnedLoading.value = true;
    pinnedError.value = false;

    try {
      const data = await $http<PinnedMessagesResponse>('messages/pinned', {
        query: {
          dialog_id: dialogId,
          limit: 100,
        },
      });

      if (requestId !== pinnedRequestSequence || dialog.current?.dialog_id !== dialogId) return;
      pinnedList.value = data?.data ?? [];
    } catch {
      if (requestId === pinnedRequestSequence && dialog.current?.dialog_id === dialogId) {
        pinnedError.value = true;
      }
    } finally {
      if (requestId === pinnedRequestSequence) pinnedLoading.value = false;
    }
  };

  const togglePin = async (messageId: string) => {
    if (!messageId || pinningMessageIds.value.includes(messageId)) {
      return null;
    }

    pinningMessageIds.value = [...pinningMessageIds.value, messageId];

    try {
      const data = await $http<MessagePinResponse>(
        `messages/${encodeURIComponent(messageId)}/pin`,
        {
          method: 'PATCH',
        },
      );
      const updatedMessage = data?.data ?? null;

      if (!updatedMessage) {
        return null;
      }

      list.value = list.value.map((item) =>
        item.id === updatedMessage.id ? updatedMessage : item,
      );
      pinnedList.value = updatedMessage.is_pinned
        ? [
            updatedMessage,
            ...pinnedList.value.filter((message) => message.id !== updatedMessage.id),
          ]
        : pinnedList.value.filter((message) => message.id !== updatedMessage.id);

      if (dialog.current?.message?.id === updatedMessage.id) {
        dialog.current.message = updatedMessage;
      }

      return updatedMessage;
    } finally {
      pinningMessageIds.value = pinningMessageIds.value.filter((id) => id !== messageId);
    }
  };

  const startEditing = (message: ChatMessage) => {
    replyMessage.value = null;
    editingMessage.value = message;
  };

  const cancelEditing = () => {
    editingMessage.value = null;
  };

  const startReply = (message: ChatMessage) => {
    editingMessage.value = null;
    replyMessage.value = message;
  };

  const cancelReply = () => {
    replyMessage.value = null;
  };

  const restoreReplyDraft = (message?: ChatMessage | null) => {
    replyMessage.value = message ?? null;
  };

  const setSearchHighlightQuery = (query?: string | null) => {
    searchHighlightQuery.value = String(query ?? '').trim();
  };

  const loadOlder = async () => {
    if (loading.value || olderLoading.value || !olderCursor.value) {
      return;
    }

    await loadHistory({ direction: 'older', cursor: olderCursor.value });
  };

  const retryOlder = async () => {
    const request = lastHistoryRequests.get('older');
    if (request) {
      await loadHistory(request);
    }
  };

  const loadNewer = async () => {
    if (loading.value || newerLoading.value || !newerCursor.value) {
      return;
    }

    await loadHistory({ direction: 'newer', cursor: newerCursor.value });
  };

  const retryNewer = async () => {
    const request = lastHistoryRequests.get('newer');
    if (request) {
      await loadHistory(request);
    }
  };

  const loadAroundMessage = async (
    messageId?: string | null,
    highlight = true,
    block: MessageScrollBlock = 'center',
  ) => {
    if (!messageId) {
      return;
    }

    if (findMessage(messageId)) {
      scrollToMessage(messageId, highlight, block, 'smooth');
      return;
    }

    scrollToMessage(messageId, highlight, block, 'auto');
    await loadHistory({ direction: 'initial', cursorId: messageId });
  };

  const cancelHistoryRequests = () => {
    requestSequence.value += 1;
    activeHistoryRequests.forEach(({ controller }) => controller.abort());
    activeHistoryRequests.clear();
    initialLoading.value = false;
    olderLoading.value = false;
    newerLoading.value = false;
  };

  function $reset() {
    pinnedRequestSequence += 1;
    cancelHistoryRequests();
    lastHistoryRequests.clear();
    if (readFlushTimer) {
      clearTimeout(readFlushTimer);
      readFlushTimer = null;
    }
    pendingReadMessageId = null;
    readRequestInFlight = false;
    list.value = [];
    initialLoading.value = true;
    initialError.value = false;
    sending.value = false;
    editingMessageIds.value = [];
    deletingMessageIds.value = [];
    pinningMessageIds.value = [];
    editingMessage.value = null;
    replyMessage.value = null;
    pinnedList.value = [];
    pinnedLoading.value = false;
    pinnedError.value = false;

    olderCursor.value = null;
    newerCursor.value = null;
    olderError.value = false;
    newerError.value = false;
    scrollIntent.value = null;
    unreadBoundaryMessageId.value = null;
    searchHighlightQuery.value = '';
  }

  return {
    list,
    loading,
    error,
    initialLoading,
    initialError,
    sending,
    editingMessageIds,
    deletingMessageIds,
    pinningMessageIds,
    editingMessage,
    replyMessage,
    pinnedList,
    latestPinnedMessage,
    pinnedLoading,
    pinnedError,

    loadHistory,
    loadInitial,
    retryInitial,
    send,
    update,
    togglePin,
    fetchPinned,
    remove,
    startEditing,
    cancelEditing,
    startReply,
    cancelReply,
    restoreReplyDraft,
    setSearchHighlightQuery,
    appendMessage,
    receiveMessage,
    receiveMessageUpdate,
    receiveMessageDeleted,
    scrollToMessage,
    consumeScrollIntent,
    markReadUntil,

    loadOlder,
    retryOlder,
    loadNewer,
    retryNewer,
    loadAroundMessage,
    cancelHistoryRequests,

    olderCursor,
    newerCursor,
    scrollIntent,
    unreadBoundaryMessageId,
    searchHighlightQuery,

    olderLoading,
    newerLoading,
    olderError,
    newerError,

    $reset,
  };
});
