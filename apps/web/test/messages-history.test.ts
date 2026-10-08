import assert from 'node:assert/strict';
import test from 'node:test';
import { createPinia, defineStore, setActivePinia } from 'pinia';
import { nextTick, ref } from 'vue';
import type { ChatMessage } from '../app/types/models.ts';

type HttpCall = {
  path: string;
  options?: {
    query?: Record<string, string>;
    signal?: AbortSignal;
  };
};

type MessagesPage = {
  data: ChatMessage[];
  older_cursor: string | null;
  newer_cursor: string | null;
};

const dialog = {
  current: {
    id: 'dialog-1',
    dialog_id: 'dialog-1',
    counter: 0,
    first_unread_message_id: null as string | null,
  },
};
const dialogs = {
  readUntil: async (_dialogId: string, _messageId: string) => ({ ok: true, counter: 0 }),
  syncMessage: () => true,
};

let http: (path: string, options?: HttpCall['options']) => Promise<MessagesPage>;

Object.assign(globalThis, {
  defineStore,
  nextTick,
  ref,
  useDialogStore: () => dialog,
  useDialogsStore: () => dialogs,
  $http: (path: string, options?: HttpCall['options']) => http(path, options),
});

const { useMessagesStore } = await import('../app/stores/messages.ts');

const message = (id: string, dialogId = dialog.current.dialog_id): ChatMessage => ({
  id,
  dialog_id: dialogId,
  sender_id: 'user-1',
  message: `Message ${id}`,
  is_sender: false,
  created_at: `2026-09-30T10:${id.padStart(2, '0')}:00.000Z`,
  updated_at: `2026-09-30T10:${id.padStart(2, '0')}:00.000Z`,
});

const page = (
  data: ChatMessage[] = [],
  olderCursor: string | null = null,
  newerCursor: string | null = null,
): MessagesPage => ({ data, older_cursor: olderCursor, newer_cursor: newerCursor });

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
};

const freshStore = () => {
  setActivePinia(createPinia());
  dialog.current.dialog_id = 'dialog-1';
  dialog.current.id = 'dialog-1';
  dialog.current.counter = 0;
  dialog.current.first_unread_message_id = null;
  return useMessagesStore();
};

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

test('keeps initial older and newer errors independent', async () => {
  const messages = freshStore();
  http = async () => {
    throw new Error('initial failed');
  };

  await messages.loadInitial();
  assert.equal(messages.initialError, true);
  assert.equal(messages.olderError, false);
  assert.equal(messages.newerError, false);

  messages.list = [message('2')];
  messages.olderCursor = 'older-2';
  http = async () => {
    throw new Error('older failed');
  };

  await messages.loadOlder();
  assert.equal(messages.initialError, true);
  assert.equal(messages.olderError, true);
  assert.equal(messages.newerError, false);

  messages.newerCursor = 'newer-2';
  http = async () => {
    throw new Error('newer failed');
  };

  await messages.loadNewer();
  assert.equal(messages.initialError, true);
  assert.equal(messages.olderError, true);
  assert.equal(messages.newerError, true);
});

test('latest pinned preview follows pin time, not message edits, and switches after unpin or delete', () => {
  const messages = freshStore();
  const oldPin = { ...message('1'), is_pinned: true, pinned_at: '2026-10-04T10:00:00Z' };
  const newPin = { ...message('2'), is_pinned: true, pinned_at: '2026-10-04T11:00:00Z' };
  messages.pinnedList = [oldPin, newPin];
  assert.equal(messages.latestPinnedMessage?.id, newPin.id);
  messages.receiveMessageUpdate({ ...oldPin, message: 'Edited older pin' });
  assert.equal(messages.latestPinnedMessage?.id, newPin.id);
  messages.receiveMessageUpdate({ ...newPin, is_pinned: false, pinned_at: null });
  assert.equal(messages.latestPinnedMessage?.message, 'Edited older pin');
  messages.receiveMessageDeleted(oldPin.id);
  assert.equal(messages.latestPinnedMessage, null);
});

test('pinned preview never exposes a message from another dialog', () => {
  const messages = freshStore();
  messages.pinnedList = [{ ...message('1', 'other-dialog'), is_pinned: true }];
  assert.equal(messages.latestPinnedMessage, null);
});

test('pinned preview matches API message internal IDs to public dialog IDs', async () => {
  for (const type of ['D', 'G', 'C']) {
    const messages = freshStore();
    const internalId = '0199abcd-1234-7000-8000-123456789abc';
    dialog.current.id = internalId;
    dialog.current.dialog_id = `${type}-${internalId}`;
    const pinned = { ...message('1', internalId), is_pinned: true };
    http = async () => page([pinned]);
    await messages.fetchPinned();
    assert.equal(messages.latestPinnedMessage?.id, pinned.id);
    messages.pinnedList = [{ ...pinned, dialog_id: 'another-internal-id' }];
    assert.equal(messages.latestPinnedMessage, null);
  }
});

test('retries the same failed history intent', async () => {
  const messages = freshStore();
  const calls: HttpCall[] = [];
  let attempt = 0;
  http = async (path, options) => {
    calls.push({ path, options });
    attempt += 1;
    if (attempt === 1) {
      throw new Error('temporary');
    }
    return page([message('5')], 'older-5', 'newer-5');
  };

  await messages.loadInitial({ cursorId: '5' });
  await messages.retryInitial();

  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0]?.options?.query, {
    dialog_id: 'dialog-1',
    cursor_id: '5',
  });
  assert.deepEqual(calls[0]?.options?.query, calls[1]?.options?.query);
  assert.deepEqual(
    messages.list.map(({ id }) => id),
    ['5'],
  );
  assert.equal(messages.initialError, false);
});

test('ignores a duplicate cursor request while it is active', async () => {
  const messages = freshStore();
  const pending = deferred<MessagesPage>();
  let calls = 0;
  messages.loading = false;
  messages.list = [message('2')];
  messages.olderCursor = 'older-2';
  http = async () => {
    calls += 1;
    return pending.promise;
  };

  const first = messages.loadOlder();
  const duplicate = messages.loadOlder();
  assert.equal(calls, 1);

  pending.resolve(page([message('1')], null, 'newer-1'));
  await Promise.all([first, duplicate]);
  assert.deepEqual(
    messages.list.map(({ id }) => id),
    ['1', '2'],
  );
});

test('cancels late history results after switching dialogs', async () => {
  const messages = freshStore();
  const pending = deferred<MessagesPage>();
  http = async () => pending.promise;

  const request = messages.loadInitial();
  dialog.current.dialog_id = 'dialog-2';
  messages.cancelHistoryRequests();
  messages.list = [message('9', 'dialog-2')];
  pending.resolve(page([message('1', 'dialog-1')]));
  await request;

  assert.deepEqual(
    messages.list.map(({ id }) => id),
    ['9'],
  );
  assert.equal(messages.loading, false);
});

test('navigating around an existing message keeps the current window', async () => {
  const messages = freshStore();
  const loaded = message('4');
  let calls = 0;
  messages.loading = false;
  messages.list = [loaded];
  http = async () => {
    calls += 1;
    return page();
  };

  await messages.loadAroundMessage(loaded.id, true, 'center');

  assert.deepEqual(messages.list, [loaded]);
  assert.equal(calls, 0);
  assert.deepEqual(messages.scrollIntent, {
    messageId: loaded.id,
    highlight: true,
    block: 'center',
    behavior: 'smooth',
  });
});

test('pinned messages ignore a response from the previous dialog and keep the new request loading', async () => {
  const messages = freshStore();
  const previous = deferred<MessagesPage>();
  const current = deferred<MessagesPage>();
  let calls = 0;
  http = async () => (++calls === 1 ? previous.promise : current.promise);
  const first = messages.fetchPinned();
  messages.$reset();
  dialog.current.dialog_id = 'dialog-2';
  const second = messages.fetchPinned();
  previous.resolve(page([message('1', 'dialog-1')]));
  await first;
  assert.deepEqual(messages.pinnedList, []);
  assert.equal(messages.pinnedLoading, true);
  current.resolve(page([message('2', 'dialog-2')]));
  await second;
  assert.deepEqual(
    messages.pinnedList.map((item) => item.id),
    ['2'],
  );
  assert.equal(messages.pinnedLoading, false);
});

test('keeps later read progress queued while a read request is active', async () => {
  const messages = freshStore();
  const firstRead = deferred<{ ok: boolean; counter: number; last_read_at: string }>();
  const calls: string[] = [];
  dialog.current.counter = 2;
  messages.list = [message('1'), message('2')];
  dialogs.readUntil = async (_dialogId, messageId) => {
    calls.push(messageId);
    if (calls.length === 1) {
      return firstRead.promise;
    }
    return { ok: true, counter: 0, last_read_at: messages.list[1]!.created_at };
  };

  messages.markReadUntil('1');
  await wait(375);
  messages.markReadUntil('2');
  await wait(375);

  firstRead.resolve({ ok: true, counter: 1, last_read_at: messages.list[0]!.created_at });
  await wait(300);

  assert.deepEqual(calls, ['1', '2']);
});

test('sending a message keeps a new reply selected while the request was pending', async () => {
  const messages = freshStore();
  const pending = deferred<{ ok: boolean; data: ChatMessage }>();
  http = async () => pending.promise as unknown as MessagesPage;
  messages.startReply(message('1'));

  const sending = messages.send('<p>Hello</p>');
  messages.startReply(message('2'));
  pending.resolve({ ok: true, data: message('3') });
  await sending;

  assert.equal(messages.replyMessage?.id, '2');
});
