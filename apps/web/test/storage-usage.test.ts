import assert from 'node:assert/strict';
import test from 'node:test';
import { clearChatCache, getChatCacheUsage, getDraftUsage } from '../app/utils/storage-usage.ts';

test('counts cached bodies without fetching and clears only the requested chat cache', async () => {
  const deleted: string[] = [];
  const opened: string[] = [];
  const storage = {
    keys: async () => [
      'storage-cache',
      'api-cache',
      'workbox-precache',
      'octo-notification-settings-v1',
    ],
    open: async (name: string) => {
      opened.push(name);
      return {
        keys: async () => ['a', 'b'],
        match: async (key: string) => new Response(key === 'a' ? 'abc' : 'hello'),
      };
    },
    delete: async (name: string) => {
      deleted.push(name);
      return true;
    },
  } as unknown as CacheStorage;
  assert.deepEqual(await getChatCacheUsage(storage, 'media'), { bytes: 8, count: 2 });
  await clearChatCache(storage, 'media');
  assert.deepEqual(opened, ['storage-cache']);
  assert.deepEqual(deleted, ['storage-cache']);
});

test('does not create an absent cache to measure it', async () => {
  const storage = {
    keys: async () => [],
    open: () => {
      throw new Error('unexpected open');
    },
  } as unknown as CacheStorage;
  assert.deepEqual(await getChatCacheUsage(storage, 'data'), { bytes: 0, count: 0 });
});

test('draft accounting includes only the current account and leaves stored values intact', () => {
  const entries = new Map([
    ['octo:messages-draft:v1:alice:chat', 'draft'],
    ['octo:messages-draft:v1:bob:chat', 'other'],
    ['auth_token', 'secret'],
  ]);
  const storage = {
    length: entries.size,
    key: (index: number) => [...entries.keys()][index],
    getItem: (key: string) => entries.get(key),
  } as unknown as Storage;
  assert.deepEqual(getDraftUsage(storage, 'alice'), {
    bytes: ('octo:messages-draft:v1:alice:chat'.length + 5) * 2,
    count: 1,
  });
  assert.deepEqual(getDraftUsage(storage, ''), { bytes: 0, count: 0 });
  assert.equal(entries.get('auth_token'), 'secret');
  assert.equal(entries.size, 3);
});
