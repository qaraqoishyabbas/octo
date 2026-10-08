import assert from 'node:assert/strict';
import test from 'node:test';

type Message = {
  id: string;
  sender_id: string | null;
  created_at: string;
};

type MessageEntry = {
  type: 'message';
  key: string;
  message: Message;
  groupSectionStart: boolean;
  groupSectionEnd: boolean;
};

type ListEntry =
  | { type: 'date'; key: string; label: string }
  | { type: 'unread'; key: string; label: string }
  | MessageEntry;

type DialogMessageGroupsModule = {
  groupDialogMessages?: (
    messages: Message[],
    options: {
      unreadBoundaryMessageId?: string | null;
      getDayKey: (message: Message) => string;
      formatDayLabel: (dayKey: string) => string;
    },
  ) => ListEntry[];
};

const loadMessageGroups = async (): Promise<DialogMessageGroupsModule> =>
  import('../app/utils/dialog-message-groups.ts').catch(() => ({}));

const message = (id: string, senderId: string | null, day: string): Message => ({
  id,
  sender_id: senderId,
  created_at: day,
});

const group = async (messages: Message[], unreadBoundaryMessageId?: string | null) => {
  const module = await loadMessageGroups();
  assert.equal(typeof module.groupDialogMessages, 'function');

  return module.groupDialogMessages!(messages, {
    unreadBoundaryMessageId,
    getDayKey: (item) => item.created_at,
    formatDayLabel: (dayKey) => `label:${dayKey}`,
  });
};

test('groups dates and adjacent senders', async () => {
  const first = message('1', 'alice', '2026-09-29');
  const second = message('2', 'alice', '2026-09-29');
  const third = message('3', 'bob', '2026-09-29');
  const fourth = message('4', 'bob', '2026-09-30');

  assert.deepEqual(await group([first, second, third, fourth]), [
    { type: 'date', key: 'date-2026-09-29', label: 'label:2026-09-29' },
    {
      type: 'message',
      key: 'message-1',
      message: first,
      groupSectionStart: true,
      groupSectionEnd: false,
    },
    {
      type: 'message',
      key: 'message-2',
      message: second,
      groupSectionStart: false,
      groupSectionEnd: true,
    },
    {
      type: 'message',
      key: 'message-3',
      message: third,
      groupSectionStart: true,
      groupSectionEnd: true,
    },
    { type: 'date', key: 'date-2026-09-30', label: 'label:2026-09-30' },
    {
      type: 'message',
      key: 'message-4',
      message: fourth,
      groupSectionStart: true,
      groupSectionEnd: true,
    },
  ]);
});

test('places one unread divider before the boundary', async () => {
  const first = message('1', 'alice', '2026-09-30');
  const second = message('2', 'alice', '2026-09-30');

  assert.deepEqual(await group([first, second], '2'), [
    { type: 'date', key: 'date-2026-09-30', label: 'label:2026-09-30' },
    {
      type: 'message',
      key: 'message-1',
      message: first,
      groupSectionStart: true,
      groupSectionEnd: false,
    },
    { type: 'unread', key: 'unread-2', label: 'Непрочитанное сообщение' },
    {
      type: 'message',
      key: 'message-2',
      message: second,
      groupSectionStart: false,
      groupSectionEnd: true,
    },
  ]);
});

test('keeps system messages in separate sender groups', async () => {
  const authoredBefore = message('1', 'alice', '2026-09-30');
  const system = message('2', null, '2026-09-30');
  const authoredAfter = message('3', 'alice', '2026-09-30');

  const entries = await group([authoredBefore, system, authoredAfter]);
  const messages = entries.filter((entry): entry is MessageEntry => entry.type === 'message');

  assert.deepEqual(
    messages.map(({ key, groupSectionStart, groupSectionEnd }) => ({
      key,
      groupSectionStart,
      groupSectionEnd,
    })),
    [
      { key: 'message-1', groupSectionStart: true, groupSectionEnd: true },
      { key: 'message-2', groupSectionStart: true, groupSectionEnd: true },
      { key: 'message-3', groupSectionStart: true, groupSectionEnd: true },
    ],
  );
});

test('uses a stable unknown-date group', async () => {
  const first = message('1', 'alice', 'unknown');
  const second = message('2', 'alice', 'unknown');

  assert.deepEqual(await group([first, second]), [
    { type: 'date', key: 'date-unknown', label: 'label:unknown' },
    {
      type: 'message',
      key: 'message-1',
      message: first,
      groupSectionStart: true,
      groupSectionEnd: false,
    },
    {
      type: 'message',
      key: 'message-2',
      message: second,
      groupSectionStart: false,
      groupSectionEnd: true,
    },
  ]);
});
