import assert from 'node:assert/strict';
import test from 'node:test';
import { effectScope, ref, nextTick } from 'vue';

const cached = new Map<string, Response>();
const revocations: string[] = [];
const blobs: Blob[] = [];
let fetchCount = 0;
let finish!: () => void;
const pending = new Map<string, Promise<void>>();
Object.assign(globalThis, {
  window: {
    caches: { open: async () => ({ match: async (url: string) => cached.get(url)?.clone() }) },
  },
  useMediaAutoDownloadStore: () => ({
    waitForPrefetch: async (url: string) => {
      if (pending.has(url)) await pending.get(url);
    },
    prefetch: async (_file: unknown, url: string) => {
      fetchCount++;
      const deferred = new Promise<void>((done) => {
        finish = done;
      });
      const request = deferred.then(() => {
        cached.set(
          url,
          new Response('complete video', { headers: { 'content-type': 'video/mp4' } }),
        );
      });
      pending.set(url, request);
      await request;
      return true;
    },
  }),
});
const originalCreate = URL.createObjectURL;
const originalRevoke = URL.revokeObjectURL;
URL.createObjectURL = (blob: Blob) => {
  blobs.push(blob);
  return 'blob:cached-media';
};
URL.revokeObjectURL = (url: string) => revocations.push(url);
test.after(() => {
  URL.createObjectURL = originalCreate;
  URL.revokeObjectURL = originalRevoke;
});

async function settle() {
  await nextTick();
  await new Promise((done) => setImmediate(done));
}

test('video source stays absent until full prefetch completes, then uses cached body and releases it', async () => {
  const { useMediaCacheSource } = await import('../app/composables/useMediaCacheSource.ts');
  const file = ref({ mime_type: 'video/mp4', size: 14 });
  const url = ref('https://api.example/storage/messages/video.mp4');
  const enabled = ref(false);
  const scope = effectScope();
  const media = scope.run(() => useMediaCacheSource(file, url, enabled, { prefetch: true }))!;
  await settle();
  assert.equal(media.source.value, undefined);
  assert.equal(fetchCount, 0);
  enabled.value = true;
  await settle();
  assert.equal(fetchCount, 1);
  assert.equal(media.source.value, undefined);
  finish();
  await settle();
  assert.equal(media.source.value, 'blob:cached-media');
  assert.equal(await blobs.at(-1)!.text(), 'complete video');
  enabled.value = false;
  await settle();
  assert.equal(media.source.value, undefined);
  assert.deepEqual(revocations, ['blob:cached-media']);
  scope.stop();
});

test('manual viewer reuses cached video without prefetch and falls back to streaming an uncached video', async () => {
  const { useMediaCacheSource } = await import('../app/composables/useMediaCacheSource.ts');
  const scope = effectScope();
  const url = ref('https://api.example/storage/messages/video.mp4');
  const initialFetches = fetchCount;
  const media = scope.run(() =>
    useMediaCacheSource(ref({ mime_type: 'video/mp4' }), url, ref(true)),
  )!;
  await settle();
  assert.equal(media.source.value, 'blob:cached-media');
  assert.equal(fetchCount, initialFetches);
  url.value = 'https://api.example/storage/messages/not-cached.mp4';
  await settle();
  assert.equal(media.source.value, url.value);
  scope.stop();
});

test('manual viewer waits for existing prefetch instead of issuing a duplicate native source', async () => {
  const { useMediaCacheSource } = await import('../app/composables/useMediaCacheSource.ts');
  const scope = effectScope();
  const url = ref('https://api.example/storage/messages/in-flight.mp4');
  const file = ref({ mime_type: 'video/mp4', size: 14 });
  const tile = scope.run(() => useMediaCacheSource(file, url, ref(true), { prefetch: true }))!;
  await settle();
  const viewer = scope.run(() => useMediaCacheSource(file, url, ref(true)))!;
  await settle();
  assert.equal(tile.source.value, undefined);
  assert.equal(viewer.source.value, undefined);
  finish();
  await settle();
  assert.equal(tile.source.value, 'blob:cached-media');
  assert.equal(viewer.source.value, 'blob:cached-media');
  scope.stop();
});
