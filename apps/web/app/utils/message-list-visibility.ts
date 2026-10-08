import type { ChatMessage } from '~/types';

export function getLastVisibleUnreadMessageId(options: {
  messages: ChatMessage[];
  visibleIds: string[];
  lastReadAt?: string | null;
  pendingId?: string | null;
  documentHidden: boolean;
}): string | null {
  if (options.documentHidden) {
    return null;
  }

  const visibleIds = new Set(options.visibleIds);
  const lastReadTimestamp = options.lastReadAt ? Date.parse(options.lastReadAt) : null;
  let candidateIndex = -1;

  options.messages.forEach((message, index) => {
    if (message.is_sender || !visibleIds.has(message.id)) {
      return;
    }

    if (
      lastReadTimestamp !== null &&
      Number.isFinite(lastReadTimestamp) &&
      Date.parse(message.created_at) <= lastReadTimestamp
    ) {
      return;
    }

    candidateIndex = index;
  });

  if (candidateIndex < 0) {
    return null;
  }

  const pendingIndex = options.pendingId
    ? options.messages.findIndex((message) => message.id === options.pendingId)
    : -1;

  if (pendingIndex >= candidateIndex) {
    return null;
  }

  return options.messages[candidateIndex]?.id ?? null;
}
