import type { ChatMessage } from '~/types';

export type MessageLoadDirection = 'initial' | 'older' | 'newer';

export type MessagesPage = {
  data: ChatMessage[];
  older_cursor: string | null;
  newer_cursor: string | null;
};

export type MessageWindowState = {
  list: ChatMessage[];
  olderCursor: string | null;
  newerCursor: string | null;
};

export type MessageReferenceState = {
  window: MessageWindowState;
  pinnedList: ChatMessage[];
  editingMessage: ChatMessage | null;
  replyMessage: ChatMessage | null;
  dialogMessage: ChatMessage | null;
};

const DEFAULT_MAX_MESSAGES = 60;

const encodeCursor = (message: ChatMessage, pointsToNextItems: boolean) =>
  btoa(
    JSON.stringify({
      created_at: message.created_at,
      id: message.id,
      _pointsToNextItems: pointsToNextItems,
    }),
  );

const deduplicateMessages = (messages: ChatMessage[]) => {
  const order: string[] = [];
  const byId = new Map<string, ChatMessage>();

  messages.forEach((message) => {
    if (!byId.has(message.id)) {
      order.push(message.id);
    }

    byId.set(message.id, message);
  });

  return order.flatMap((id) => {
    const message = byId.get(id);
    return message ? [message] : [];
  });
};

export function mergeMessageWindow(
  state: MessageWindowState,
  page: MessagesPage,
  direction: MessageLoadDirection,
  maxMessages = DEFAULT_MAX_MESSAGES,
): MessageWindowState {
  const incoming = page.data ?? [];

  if (direction === 'initial') {
    const merged = deduplicateMessages(incoming);
    const list = merged.slice(-maxMessages);
    const wasTrimmed = list.length < merged.length;
    const first = list[0];

    return {
      list,
      olderCursor:
        wasTrimmed && first ? encodeCursor(first, true) : page.older_cursor,
      newerCursor: page.newer_cursor,
    };
  }

  if (direction === 'older') {
    const merged = deduplicateMessages([...incoming, ...state.list]);
    const list = merged.slice(0, maxMessages);
    const wasTrimmed = list.length < merged.length;
    const last = list.at(-1);

    return {
      list,
      olderCursor: page.older_cursor,
      newerCursor:
        wasTrimmed && last ? encodeCursor(last, false) : state.newerCursor,
    };
  }

  const merged = deduplicateMessages([...state.list, ...incoming]);
  const list = merged.slice(-maxMessages);
  const wasTrimmed = list.length < merged.length;
  const first = list[0];

  return {
    list,
    olderCursor:
      wasTrimmed && first ? encodeCursor(first, true) : state.olderCursor,
    newerCursor: page.newer_cursor,
  };
}

export function reconcileCreatedMessage(
  state: MessageWindowState,
  message: ChatMessage,
  maxMessages = DEFAULT_MAX_MESSAGES,
): MessageWindowState {
  if (state.newerCursor || state.list.some((item) => item.id === message.id)) {
    return state;
  }

  const merged = [...state.list, message];
  const list = merged.slice(-maxMessages);
  const first = list[0];

  return {
    list,
    olderCursor:
      list.length < merged.length && first ? encodeCursor(first, true) : state.olderCursor,
    newerCursor: null,
  };
}

export function reconcileUpdatedMessage(
  state: MessageReferenceState,
  message: ChatMessage,
): MessageReferenceState {
  const replace = (item: ChatMessage) => (item.id === message.id ? message : item);

  return {
    window: {
      ...state.window,
      list: state.window.list.map(replace),
    },
    pinnedList: message.is_pinned
      ? [message, ...state.pinnedList.filter((item) => item.id !== message.id)]
      : state.pinnedList.filter((item) => item.id !== message.id),
    editingMessage: state.editingMessage?.id === message.id ? message : state.editingMessage,
    replyMessage: state.replyMessage?.id === message.id ? message : state.replyMessage,
    dialogMessage: state.dialogMessage?.id === message.id ? message : state.dialogMessage,
  };
}

export function reconcileDeletedMessage(
  state: MessageReferenceState,
  messageId: string,
): MessageReferenceState {
  return {
    window: {
      ...state.window,
      list: state.window.list.filter((message) => message.id !== messageId),
    },
    pinnedList: state.pinnedList.filter((message) => message.id !== messageId),
    editingMessage: state.editingMessage?.id === messageId ? null : state.editingMessage,
    replyMessage: state.replyMessage?.id === messageId ? null : state.replyMessage,
    dialogMessage: state.dialogMessage?.id === messageId ? null : state.dialogMessage,
  };
}
