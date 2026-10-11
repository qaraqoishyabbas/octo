import assert from 'node:assert/strict';
import test from 'node:test';
import { createPinia, disposePinia, setActivePinia } from 'pinia';
import { nextTick, reactive } from 'vue';
import { readFileSync } from 'node:fs';
import { parse } from '@vue/compiler-sfc';
import { compile } from '@vue/compiler-dom';
import * as Vue from 'vue';
import { renderToString } from '@vue/server-renderer';
import { formatStorageBytes, formatCacheUsage } from '../app/utils/storage-usage.ts';

const auth = reactive({ user: { id: 'alice' } });
const removedDrafts: string[] = [];
Object.assign(globalThis, {
  useAuthStore: () => auth,
  useMessagesDraftStore: () => ({ clearUser: (id: string) => removedDrafts.push(id) }),
});
const { useStorageUsageStore } = await import('../app/stores/storage-usage.ts');

test('insecure origins explain unavailable cache and the dashboard does not report zero usage', async () => {
  Object.assign(globalThis, {
    window: {
      isSecureContext: false,
      localStorage: { length: 0, key: () => null, getItem: () => null },
    },
  });
  const pinia = createPinia();
  setActivePinia(pinia);
  const memory = useStorageUsageStore();
  await memory.refresh();
  assert.match(memory.cacheUnavailableReason, /HTTPS/);
  assert.match(memory.cacheUnavailableReason, /localhost/);
  const source = readFileSync(
    new URL('../app/components/feature/setting/SettingDataStorage.vue', import.meta.url),
    'utf8',
  );
  const render = new Function(
    'Vue',
    compile(parse(source).descriptor.template!.content, {
      mode: 'function',
      prefixIdentifiers: true,
    }).code,
  )(Vue);
  const app = Vue.createSSRApp({
    setup: () => ({
      memory,
      network: { totalBytes: 0 },
      autoDownload: { summary: () => '' },
      formatStorageBytes,
      formatCacheUsage,
      requestReset: () => {},
    }),
    render,
  });
  for (const name of ['USlideover', 'AppBar', 'UButton']) {
    app.component(name, {
      setup(_props, { slots }) {
        return () =>
          Vue.h(
            'div',
            Object.values(slots).flatMap((slot) => slot?.()),
          );
      },
    });
  }
  const html = await renderToString(app);
  assert.match(html, /Использование памяти<\/span>\s*<span[^>]*>Недоступно<\/span>/);
  disposePinia(pinia);
});

test('selected cleanup preserves unselected media, API data and drafts', async () => {
  const media = new Map([
    ['photo', { text: 'abc', mime: 'image/png' }],
    ['video', { text: 'hello', mime: 'video/mp4' }],
  ]);
  const deletions: string[] = [];
  Object.assign(globalThis, {
    window: {
      caches: {
        keys: async () => ['storage-cache', 'api-cache'],
        open: async (name: string) =>
          name === 'api-cache'
            ? { keys: async () => ['data'], match: async () => new Response('{}') }
            : {
                keys: async () => [...media.keys()],
                match: async (key: string) => {
                  const item = media.get(key);
                  return (
                    item && new Response(item.text, { headers: { 'content-type': item.mime } })
                  );
                },
                delete: async (key: string) => media.delete(key),
              },
        delete: async (name: string) => {
          deletions.push(name);
          return true;
        },
      },
      localStorage: { length: 0, key: () => null, getItem: () => null },
    },
  });
  const pinia = createPinia();
  setActivePinia(pinia);
  const store = useStorageUsageStore();
  await store.refresh();
  assert.equal(store.totalBytes, 10);
  await store.clear(['photos']);
  assert.deepEqual([...media.keys()], ['video']);
  assert.equal(store.totalBytes, 7);
  assert.deepEqual(deletions, []);
  assert.deepEqual(removedDrafts, []);
  await store.clear(['drafts']);
  assert.deepEqual(removedDrafts, ['alice']);
  disposePinia(pinia);
});

test('drafts can be cleared even when cache storage is unavailable', async () => {
  Object.assign(globalThis, {
    window: { localStorage: { length: 0, key: () => null, getItem: () => null } },
  });
  const pinia = createPinia();
  setActivePinia(pinia);
  const store = useStorageUsageStore();
  await store.refresh();
  assert.equal(store.cacheSupported, false);
  await store.clear(['photos', 'data', 'drafts']);
  assert.equal(removedDrafts.at(-1), 'alice');
  assert.equal(store.error, '');
  disposePinia(pinia);
});

test('late measurement after switching accounts does not replace current usage', async () => {
  let release: () => void = () => {};
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  Object.assign(globalThis, {
    window: {
      caches: {
        keys: async () => {
          await pending;
          return [];
        },
      },
      localStorage: { length: 0, key: () => null, getItem: () => null },
    },
  });
  const pinia = createPinia();
  setActivePinia(pinia);
  const store = useStorageUsageStore();
  const request = store.refresh();
  auth.user.id = 'bob';
  await nextTick();
  release();
  await request;
  assert.equal(store.loading, false);
  assert.equal(store.usage.drafts, null);
  assert.equal(store.totalBytes, 0);
  disposePinia(pinia);
});
