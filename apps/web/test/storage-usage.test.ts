import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clearChatCache,
  getChatCacheUsage,
  getDraftUsage,
  getMediaCacheUsage,
  clearMediaCache,
  migrateAvatarCache,
  isAvatarCacheRequest,
  formatCacheUsage,
} from '../app/utils/storage-usage.ts';

test('opaque external cached files report an unknown size instead of zero bytes', async () => {
  const response = { type: 'opaque', headers: new Headers(), body: null } as unknown as Response;
  const storage = {
    keys: async () => ['avatars-cache'],
    open: async () => ({ keys: async () => ['avatar'], match: async () => response }),
  } as unknown as CacheStorage;
  const usage = await getChatCacheUsage(storage, 'avatars');
  assert.deepEqual(usage, { bytes: 0, count: 1, unknownCount: 1 });
  assert.equal(formatCacheUsage(usage), 'Размер недоступен');
  const removed: string[] = [];
  const mediaStorage = {
    keys: async () => ['storage-cache'],
    open: async () => ({
      keys: async () => ['https://api.example/storage/messages/a.webp'],
      match: async () => response,
      delete: async (key: string) => {
        removed.push(key);
        return true;
      },
    }),
  } as unknown as CacheStorage;
  assert.deepEqual((await getMediaCacheUsage(mediaStorage)).photos, {
    bytes: 0,
    count: 1,
    unknownCount: 1,
  });
  await clearMediaCache(mediaStorage, ['photos']);
  assert.equal(removed.length, 1);
});

test('legacy avatars move to their own cache and survive photo cleanup', async () => {
  const avatar = 'https://api.example/storage/avatars/a.webp';
  const photo = 'https://api.example/storage/messages/a.webp';
  const media = new Map([
    [avatar, 'avatar'],
    [photo, 'photo'],
  ]);
  const avatars = new Map<string, string>();
  const maps = new Map([
    ['storage-cache', media],
    ['avatars-cache', avatars],
  ]);
  const storage = {
    keys: async () => [...maps.keys()],
    open: async (name: string) => {
      const map = maps.get(name)!;
      return {
        keys: async () => [...map.keys()],
        match: async (key: string) =>
          map.has(key)
            ? new Response(map.get(key), { headers: { 'content-type': 'image/webp' } })
            : undefined,
        put: async (key: string, response: Response) => map.set(key, await response.text()),
        delete: async (key: string) => map.delete(key),
      };
    },
    delete: async (name: string) => maps.delete(name),
  } as unknown as CacheStorage;
  await Promise.all([migrateAvatarCache(storage), migrateAvatarCache(storage)]);
  assert.deepEqual([...media.keys()], [photo]);
  assert.equal(avatars.get(avatar), 'avatar');
  assert.deepEqual(await getChatCacheUsage(storage, 'avatars'), { bytes: 6, count: 1 });
  await clearMediaCache(storage, ['photos']);
  assert.equal(media.size, 0);
  assert.equal(avatars.size, 1);
  await clearChatCache(storage, 'avatars');
  assert.equal(maps.has('avatars-cache'), false);
});

test('failed avatar migration preserves the original cached file', async () => {
  const avatar = new Request('https://api.example/storage/avatars/a.webp');
  let deleted = false;
  const storage = {
    keys: async () => ['storage-cache'],
    open: async (name: string) =>
      name === 'storage-cache'
        ? {
            keys: async () => [avatar],
            match: async () => new Response('avatar'),
            delete: async () => {
              deleted = true;
            },
          }
        : {
            match: async () => undefined,
            put: async () => {
              throw new Error('quota exceeded');
            },
          },
  } as unknown as CacheStorage;
  await assert.rejects(migrateAvatarCache(storage), /quota exceeded/);
  assert.equal(deleted, false);
  assert.equal(
    isAvatarCacheRequest(
      'https://api.example/storage/messages/a.webp?next=/storage/avatars/a.webp',
    ),
    false,
  );
});

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
