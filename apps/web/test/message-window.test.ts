import assert from 'node:assert/strict';
import test from 'node:test';

type Message = {
  id: string;
  dialog_id: string;
  sender_id: string | null;
  message: string;
  is_sender: boolean;
  is_pinned?: boolean;
  created_at: string;
  updated_at: string;
};

type WindowState = {
  list: Message[];
  olderCursor: string | null;
  newerCursor: string | null;
};

type ReferenceState = {
  window: WindowState;
  pinnedList: Message[];
  editingMessage: Message | null;
  replyMessage: Message | null;
  dialogMessage: Message | null;
};

type MessageWindowModule = {
  mergeMessageWindow?: (
    state: WindowState,
    page: { data: Message[]; older_cursor: string | null; newer_cursor: string | null },
    direction: 'initial' | 'older' | 'newer',
    maxMessages?: number,
  ) => WindowState;
  reconcileCreatedMessage?: (
    state: WindowState,
    message: Message,
    maxMessages?: number,
  ) => WindowState;
  reconcileUpdatedMessage?: (state: ReferenceState, message: Message) => ReferenceState;
  reconcileDeletedMessage?: (state: ReferenceState, messageId: string) => ReferenceState;
};

const loadMessageWindow = async (): Promise<MessageWindowModule> =>
  import('../app/utils/message-window.ts').catch(() => ({}));

const message = (index: number, overrides: Partial<Message> = {}): Message => ({
  id: String(index),
  dialog_id: 'dialog-1',
  sender_id: 'user-1',
  message: `Message ${index}`,
  is_sender: false,
  created_at: `2026-09-30T10:${String(index).padStart(2, '0')}:00.000Z`,
  updated_at: `2026-09-30T10:${String(index).padStart(2, '0')}:00.000Z`,
  ...overrides,
});

const state = (list: Message[], olderCursor = 'older', newerCursor = 'newer'): WindowState => ({
  list,
  olderCursor,
  newerCursor,
});

const cursorPayload = (cursor: string | null) =>
  cursor ? JSON.parse(atob(cursor)) : null;

test('replaces the message window on initial load', async () => {
  const module = await loadMessageWindow();
  assert.equal(typeof module.mergeMessageWindow, 'function');
  const loaded = [message(2), message(3)];

  assert.deepEqual(
    module.mergeMessageWindow!(
      state([message(1)]),
      { data: loaded, older_cursor: 'page-older', newer_cursor: 'page-newer' },
      'initial',
    ),
    state(loaded, 'page-older', 'page-newer'),
  );
});

test('prepends older messages and removes duplicate ids', async () => {
  const module = await loadMessageWindow();
  assert.equal(typeof module.mergeMessageWindow, 'function');
  const existingBoundary = message(3, { message: 'Current value' });

  const result = module.mergeMessageWindow!(
    state([existingBoundary, message(4)]),
    {
      data: [message(1), message(2), message(3, { message: 'Stale page value' })],
      older_cursor: 'next-older',
      newer_cursor: 'ignored-newer',
    },
    'older',
  );

  assert.deepEqual(result.list.map(({ id }) => id), ['1', '2', '3', '4']);
  assert.equal(result.list[2]?.message, 'Current value');
  assert.equal(result.olderCursor, 'next-older');
  assert.equal(result.newerCursor, 'newer');
});

test('appends newer messages and removes duplicate ids', async () => {
  const module = await loadMessageWindow();
  assert.equal(typeof module.mergeMessageWindow, 'function');

  const result = module.mergeMessageWindow!(
    state([message(1), message(2, { message: 'Old value' })]),
    {
      data: [message(2, { message: 'Fresh value' }), message(3)],
      older_cursor: 'ignored-older',
      newer_cursor: 'next-newer',
    },
    'newer',
  );

  assert.deepEqual(result.list.map(({ id }) => id), ['1', '2', '3']);
  assert.equal(result.list[1]?.message, 'Fresh value');
  assert.equal(result.olderCursor, 'older');
  assert.equal(result.newerCursor, 'next-newer');
});

test('trims older loads to 60 and reconstructs the newer cursor', async () => {
  const module = await loadMessageWindow();
  assert.equal(typeof module.mergeMessageWindow, 'function');
  const current = Array.from({ length: 50 }, (_, index) => message(index + 21));
  const older = Array.from({ length: 20 }, (_, index) => message(index + 1));

  const result = module.mergeMessageWindow!(
    state(current, 'older-before', null),
    { data: older, older_cursor: 'older-after', newer_cursor: null },
    'older',
  );

  assert.equal(result.list.length, 60);
  assert.equal(result.list[0]?.id, '1');
  assert.equal(result.list.at(-1)?.id, '60');
  assert.deepEqual(cursorPayload(result.newerCursor), {
    created_at: result.list.at(-1)?.created_at,
    id: '60',
    _pointsToNextItems: false,
  });
});

test('trims newer loads to 60 and reconstructs the older cursor', async () => {
  const module = await loadMessageWindow();
  assert.equal(typeof module.mergeMessageWindow, 'function');
  const current = Array.from({ length: 50 }, (_, index) => message(index + 1));
  const newer = Array.from({ length: 20 }, (_, index) => message(index + 51));

  const result = module.mergeMessageWindow!(
    state(current, null, 'newer-before'),
    { data: newer, older_cursor: null, newer_cursor: 'newer-after' },
    'newer',
  );

  assert.equal(result.list.length, 60);
  assert.equal(result.list[0]?.id, '11');
  assert.equal(result.list.at(-1)?.id, '70');
  assert.deepEqual(cursorPayload(result.olderCursor), {
    created_at: result.list[0]?.created_at,
    id: '11',
    _pointsToNextItems: true,
  });
});

test('adds a created message only at the newest edge', async () => {
  const module = await loadMessageWindow();
  assert.equal(typeof module.reconcileCreatedMessage, 'function');
  const created = message(3);

  const newest = module.reconcileCreatedMessage!(state([message(1), message(2)], 'older', null), created);
  assert.deepEqual(newest.list.map(({ id }) => id), ['1', '2', '3']);

  const history = state([message(1), message(2)], 'older', 'newer');
  assert.deepEqual(module.reconcileCreatedMessage!(history, created), history);
});

test('created messages keep a bounded newest window', async () => {
  const module = await loadMessageWindow();
  assert.equal(typeof module.reconcileCreatedMessage, 'function');
  const current = Array.from({ length: 60 }, (_, index) => message(index + 1));

  const result = module.reconcileCreatedMessage!(state(current, null, null), message(61));

  assert.equal(result.list.length, 60);
  assert.equal(result.list[0]?.id, '2');
  assert.equal(result.list.at(-1)?.id, '61');
  assert.equal(cursorPayload(result.olderCursor)?.id, '2');
});

test('updates every message reference consistently', async () => {
  const module = await loadMessageWindow();
  assert.equal(typeof module.reconcileUpdatedMessage, 'function');
  const original = message(2);
  const updated = message(2, { message: 'Updated', is_pinned: true });
  const references: ReferenceState = {
    window: state([message(1), original]),
    pinnedList: [],
    editingMessage: original,
    replyMessage: original,
    dialogMessage: original,
  };

  const result = module.reconcileUpdatedMessage!(references, updated);

  assert.equal(result.window.list[1], updated);
  assert.deepEqual(result.pinnedList, [updated]);
  assert.equal(result.editingMessage, updated);
  assert.equal(result.replyMessage, updated);
  assert.equal(result.dialogMessage, updated);
});

test('deletes every message reference consistently', async () => {
  const module = await loadMessageWindow();
  assert.equal(typeof module.reconcileDeletedMessage, 'function');
  const removed = message(2, { is_pinned: true });
  const references: ReferenceState = {
    window: state([message(1), removed]),
    pinnedList: [removed],
    editingMessage: removed,
    replyMessage: removed,
    dialogMessage: removed,
  };

  assert.deepEqual(module.reconcileDeletedMessage!(references, removed.id), {
    window: state([message(1)]),
    pinnedList: [],
    editingMessage: null,
    replyMessage: null,
    dialogMessage: null,
  });
});
