import type { ChatMessage } from '~/types';

export type DialogMessageDateEntry = {
  type: 'date';
  key: string;
  label: string;
};

export type DialogMessageUnreadEntry = {
  type: 'unread';
  key: string;
  label: string;
};

export type DialogMessageEntry = {
  type: 'message';
  key: string;
  message: ChatMessage;
  groupSectionStart: boolean;
  groupSectionEnd: boolean;
};

export type DialogMessageListEntry =
  | DialogMessageDateEntry
  | DialogMessageUnreadEntry
  | DialogMessageEntry;

export type DialogMessageGroupOptions = {
  unreadBoundaryMessageId?: string | null;
  getDayKey: (message: ChatMessage) => string;
  formatDayLabel: (dayKey: string) => string;
};

const getSenderKey = (message: ChatMessage) =>
  message.sender_id ? String(message.sender_id) : 'system';

export function groupDialogMessages(
  messages: ChatMessage[],
  options: DialogMessageGroupOptions,
): DialogMessageListEntry[] {
  const entries: DialogMessageListEntry[] = [];

  messages.forEach((message, index) => {
    const previousMessage = messages[index - 1];
    const nextMessage = messages[index + 1];
    const dayKey = options.getDayKey(message);
    const previousDayKey = previousMessage ? options.getDayKey(previousMessage) : null;
    const nextDayKey = nextMessage ? options.getDayKey(nextMessage) : null;
    const startsDay = dayKey !== previousDayKey;
    const endsDay = dayKey !== nextDayKey;
    const senderKey = getSenderKey(message);

    if (startsDay) {
      entries.push({
        type: 'date',
        key: `date-${dayKey}`,
        label: options.formatDayLabel(dayKey),
      });
    }

    if (options.unreadBoundaryMessageId === message.id) {
      entries.push({
        type: 'unread',
        key: `unread-${message.id}`,
        label: 'Непрочитанное сообщение',
      });
    }

    entries.push({
      type: 'message',
      key: `message-${message.id}`,
      message,
      groupSectionStart:
        startsDay || !previousMessage || senderKey !== getSenderKey(previousMessage),
      groupSectionEnd: endsDay || !nextMessage || senderKey !== getSenderKey(nextMessage),
    });
  });

  return entries;
}
