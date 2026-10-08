import assert from 'node:assert/strict';
import test from 'node:test';
import { createPinia, defineStore, setActivePinia } from 'pinia';
import { nextTick, ref } from 'vue';
import type { ChatMessage } from '../app/types/models.ts';

const dialog = {
  current: {
    dialog_id: 'dialog-1',
    counter: 0,
  },
};

Object.assign(globalThis, {
  defineStore,
  nextTick,
  ref,
  useDialogStore: () => dialog,
  useDialogsStore: () => ({}),
  $http: async () => ({ data: [], older_cursor: null, newer_cursor: null }),
});

const { useMessagesStore } = await import('../app/stores/messages.ts');

const message: ChatMessage = {
  id: 'message-1',
  dialog_id: 'dialog-1',
  sender_id: 'user-1',
  message: 'Loaded message',
  is_sender: false,
  created_at: '2026-09-26T10:00:00.000Z',
  updated_at: '2026-09-26T10:00:00.000Z',
};

test('stores smooth behavior for an explicit message navigation', () => {
  setActivePinia(createPinia());
  const messages = useMessagesStore();

  messages.scrollToMessage(message.id, true, 'center', 'smooth');

  assert.deepEqual(messages.scrollIntent, {
    messageId: message.id,
    highlight: true,
    block: 'center',
    behavior: 'smooth',
  });

  messages.consumeScrollIntent(message.id);
  assert.equal(messages.scrollIntent, null);
});

test('does not consume a different message scroll intent', () => {
  setActivePinia(createPinia());
  const messages = useMessagesStore();

  messages.scrollToMessage(message.id, true, 'center', 'smooth');
  messages.consumeScrollIntent('another-message');

  assert.equal(messages.scrollIntent?.messageId, message.id);
});

test('navigates to an already loaded message without replacing the list', async () => {
  setActivePinia(createPinia());
  const messages = useMessagesStore();
  messages.loading = false;
  messages.list = [message];

  await messages.loadAroundMessage(message.id, true, 'center');

  assert.deepEqual(messages.list, [message]);
  assert.equal(messages.loading, false);
  assert.deepEqual(messages.scrollIntent, {
    messageId: message.id,
    highlight: true,
    block: 'center',
    behavior: 'smooth',
  });
});
