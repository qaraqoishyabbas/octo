import assert from 'node:assert/strict';
import test from 'node:test';
import { createPinia, disposePinia, setActivePinia } from 'pinia';
import { nextTick, reactive } from 'vue';
import { setSSRHandler } from '@vueuse/core';

const storage = new Map<string, string>();
setSSRHandler('getDefaultStorage', () => ({
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
}));
const auth = reactive({ user: { id: 'alice' } });
const dialogs = reactive({
  activeFilter: 'all',
  filterOptions: ['all', 'unread', 'direct', 'groups', 'channels', 'archive'].map((value) => ({
    value,
    label: value,
  })),
  setFilter(value: string) {
    this.activeFilter = value;
  },
});
Object.assign(globalThis, { useAuthStore: () => auth, useDialogsStore: () => dialogs });
const { useChatFoldersStore } = await import('../app/stores/chat-folders.ts');

test('first login has no folders; chosen folders persist for that account only', async () => {
  storage.clear();
  const pinia = createPinia();
  setActivePinia(pinia);
  const folders = useChatFoldersStore();
  assert.deepEqual(
    folders.visibleFilters.map((item) => item.value),
    ['all'],
  );
  assert.equal(folders.hasFolders, false);
  folders.setFolder('direct', true);
  folders.setFolder('groups', true);
  await nextTick();
  assert.deepEqual(
    folders.visibleFilters.map((item) => item.value),
    ['all', 'direct', 'groups'],
  );
  assert.equal(folders.hasFolders, true);
  auth.user.id = 'bob';
  await nextTick();
  assert.equal(folders.hasFolders, false);
  auth.user.id = 'alice';
  await nextTick();
  assert.deepEqual(folders.selectedFolders, ['direct', 'groups']);
  disposePinia(pinia);
  const freshPinia = createPinia();
  setActivePinia(freshPinia);
  assert.deepEqual(useChatFoldersStore().selectedFolders, ['direct', 'groups']);
  disposePinia(freshPinia);
});

test('disabling the active folder returns to all chats', async () => {
  const pinia = createPinia();
  setActivePinia(pinia);
  const folders = useChatFoldersStore();
  folders.setFolder('direct', true);
  dialogs.setFilter('direct');
  await nextTick();
  folders.setFolder('direct', false);
  await nextTick();
  assert.equal(dialogs.activeFilter, 'all');
  disposePinia(pinia);
});

test('saved archive folder is excluded from tabs and folder settings', async () => {
  storage.clear();
  dialogs.setFilter('all');
  storage.set('nuxt-chat-folders:alice', JSON.stringify(['archive', 'direct']));
  const pinia = createPinia();
  setActivePinia(pinia);
  const folders = useChatFoldersStore();
  await nextTick();
  assert.deepEqual(
    folders.visibleFilters.map((item) => item.value),
    ['all', 'direct'],
  );
  assert.equal(
    folders.folderOptions.some((item) => item.value === 'archive'),
    false,
  );
  disposePinia(pinia);
});

test('changing folders keeps the separately opened archive active', async () => {
  storage.clear();
  dialogs.setFilter('archive');
  const pinia = createPinia();
  setActivePinia(pinia);
  const folders = useChatFoldersStore();
  folders.setFolder('groups', true);
  await nextTick();
  assert.equal(dialogs.activeFilter, 'archive');
  disposePinia(pinia);
});
