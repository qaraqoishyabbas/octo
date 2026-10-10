import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clearChatCache,
  getChatCacheUsage,
  getDraftUsage,
  getMediaCacheUsage,
  clearMediaCache,
} from '../app/utils/storage-usage.ts';

test('media categories can be counted and cleared independently', async () => {
  const entries = new Map([
    ['photo', { text: 'abc', mime: 'image/webp' }],
    ['video', { text: 'abcde', mime: 'video/mp4' }],
    ['file', { text: 'ab', mime: 'application/pdf' }],
  ]);
  const cache = {
    keys: async () => [...entries.keys()],
    match: async (key: string) => {
      const entry = entries.get(key);
      return entry
        ? new Response(entry.text, { headers: { 'content-type': entry.mime } })
        : undefined;
    },
    delete: async (key: string) => entries.delete(key),
  };
  const storage = {
    keys: async () => ['storage-cache'],
    open: async () => cache,
  } as unknown as CacheStorage;
  assert.deepEqual(await getMediaCacheUsage(storage), {
    photos: { bytes: 3, count: 1 },
    videos: { bytes: 5, count: 1 },
    files: { bytes: 2, count: 1 },
  });
  await clearMediaCache(storage, ['photos']);
  assert.deepEqual([...entries.keys()], ['video', 'file']);
});

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
