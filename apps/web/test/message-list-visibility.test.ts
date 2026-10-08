import assert from 'node:assert/strict';
import test from 'node:test';

type Message = {
  id: string;
  is_sender: boolean;
  created_at: string;
};

type VisibilityModule = {
  getLastVisibleUnreadMessageId?: (options: {
    messages: Message[];
    visibleIds: string[];
    lastReadAt?: string | null;
    pendingId?: string | null;
    documentHidden: boolean;
  }) => string | null;
};

const loadVisibility = async (): Promise<VisibilityModule> =>
  import('../app/utils/message-list-visibility.ts').catch(() => ({}));

const message = (
  id: string,
  minute: number,
  isSender = false,
): Message => ({
  id,
  is_sender: isSender,
  created_at: `2026-09-30T10:${String(minute).padStart(2, '0')}:00.000Z`,
});

const select = async (
  messages: Message[],
  options: {
    visibleIds?: string[];
    lastReadAt?: string | null;
    pendingId?: string | null;
    documentHidden?: boolean;
  } = {},
) => {
  const module = await loadVisibility();
  assert.equal(typeof module.getLastVisibleUnreadMessageId, 'function');

  return module.getLastVisibleUnreadMessageId!({
    messages,
    visibleIds: options.visibleIds ?? messages.map(({ id }) => id),
    lastReadAt: options.lastReadAt,
    pendingId: options.pendingId,
    documentHidden: options.documentHidden ?? false,
  });
};

test('progresses only through visible incoming messages', async () => {
  const messages = [message('1', 1), message('2', 2, true), message('3', 3), message('4', 4)];

  assert.equal(await select(messages, { visibleIds: ['1', '2', '3'] }), '3');
});

test('uses list position when message timestamps tie', async () => {
  const messages = [message('first', 1), message('second', 1), message('third', 1)];

  assert.equal(await select(messages, { visibleIds: ['first', 'third', 'second'] }), 'third');
});

test('ignores messages at or before the last read timestamp', async () => {
  const messages = [message('1', 1), message('2', 2), message('3', 3)];

  assert.equal(
    await select(messages, { lastReadAt: '2026-09-30T10:02:00.000Z' }),
    '3',
  );
  assert.equal(
    await select(messages.slice(0, 2), { lastReadAt: '2026-09-30T10:02:00.000Z' }),
    null,
  );
});

test('returns null while the document is hidden', async () => {
  assert.equal(await select([message('1', 1)], { documentHidden: true }), null);
});

test('never moves read progress behind the pending message', async () => {
  const messages = [message('1', 1), message('2', 2), message('3', 3), message('4', 4)];

  assert.equal(await select(messages, { visibleIds: ['1', '2'], pendingId: '3' }), null);
  assert.equal(await select(messages, { visibleIds: ['2', '4'], pendingId: '3' }), '4');
});

test('drops a queued read candidate if the tab became hidden', async () => {
  const messages = [message('1', 1), message('2', 2)];
  const queuedVisibleIds = ['1', '2'];

  assert.equal(
    await select(messages, { visibleIds: queuedVisibleIds, documentHidden: true }),
    null,
  );
});
