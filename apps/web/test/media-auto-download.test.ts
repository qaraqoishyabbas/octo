import assert from 'node:assert/strict';
import test from 'node:test';
import { createPinia, setActivePinia, disposePinia } from 'pinia';
import { reactive, nextTick } from 'vue';

const saved = new Map<string, string>();
const auth = reactive({ user: { id: 'a' } });
const connection = new EventTarget() as EventTarget & {
  type?: string;
  saveData: boolean;
  effectiveType?: string;
};
const browserNavigator = { connection, onLine: true };
const browserWindow = Object.assign(new EventTarget(), {
  navigator: browserNavigator,
  localStorage: {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => saved.set(key, value),
  },
});
Object.assign(globalThis, { useAuthStore: () => auth, window: browserWindow });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: browserNavigator });
let activePinia: ReturnType<typeof createPinia> | undefined;
const photo = { mime_type: 'image/jpeg', type: 'media', size: 2 * 1024 ** 2 };
const video = { mime_type: 'video/mp4', type: 'media', size: 12 * 1024 ** 2 };
const document = { mime_type: 'application/pdf', type: 'file', size: 3 * 1024 ** 2 };

async function store() {
  if (activePinia) disposePinia(activePinia);
  auth.user.id = 'a';
  saved.clear();
  connection.type = undefined;
  connection.saveData = false;
  browserNavigator.onLine = true;
  activePinia = createPinia();
  setActivePinia(activePinia);
  const { useMediaAutoDownloadStore } = await import('../app/stores/media-auto-download.ts');
  const settings = useMediaAutoDownloadStore();
  await nextTick();
  return settings;
}

test('auto-load follows active connection, per-type switches and size limits', async () => {
  const settings = await store();
  assert.equal(settings.activeProfile, 'mobile');
  assert.equal(settings.canAutoLoad(photo), true);
  assert.equal(settings.canAutoLoad(video), false);
  connection.type = 'wifi';
  connection.dispatchEvent(new Event('change'));
  await nextTick();
  assert.equal(settings.activeProfile, 'wifi');
  assert.equal(settings.canAutoLoad(video), true);
  settings.updateProfile('wifi', { videos: { enabled: false, maxSizeMb: 15 } });
  assert.equal(settings.canAutoLoad(video), false);
  assert.equal(settings.canAutoLoad(photo), true);
  settings.updateProfile('wifi', { enabled: false });
  assert.equal(settings.canAutoLoad(photo), false);
  connection.type = 'cellular';
  connection.dispatchEvent(new Event('change'));
  await nextTick();
  assert.equal(settings.activeProfile, 'mobile');
  assert.equal(settings.canAutoLoad(document), true);
  assert.equal(settings.canAutoLoad({ ...photo, type: 'file', size: 11 * 1024 ** 2 }), false);
  assert.equal(settings.canAutoLoad({ ...photo, size: Number.NaN }), false);
});

test('profile edits persist by account, survive recreation and never leak between users', async () => {
  const settings = await store();
  settings.updateProfile('mobile', { photos: { enabled: false, maxSizeMb: 4 } });
  auth.user.id = 'b';
  await nextTick();
  assert.equal(settings.profiles.mobile.photos.enabled, true);
  settings.updateProfile('mobile', { enabled: false });
  auth.user.id = 'a';
  await nextTick();
  assert.equal(settings.profiles.mobile.photos.enabled, false);
  assert.equal(settings.profiles.mobile.photos.maxSizeMb, 4);
  if (activePinia) disposePinia(activePinia);
  activePinia = createPinia();
  setActivePinia(activePinia);
  const { useMediaAutoDownloadStore } = await import('../app/stores/media-auto-download.ts');
  const restored = useMediaAutoDownloadStore();
  assert.equal(restored.profiles.mobile.photos.maxSizeMb, 4);
  assert.match(restored.summary('mobile'), /Видео/);
  assert.doesNotMatch(restored.summary('mobile'), /Фото/);
});

test('corrupt saved settings leave usable defaults and invalid limits cannot disable guards', async () => {
  const settings = await store();
  saved.set('octo:media-auto-download:v1:b', '{broken');
  auth.user.id = 'b';
  await nextTick();
  assert.equal(settings.profiles.wifi.photos.maxSizeMb, 15);
  assert.doesNotThrow(() =>
    settings.updateProfile('mobile', { photos: { enabled: true, maxSizeMb: Number.NaN } }),
  );
  assert.equal(settings.profiles.mobile.photos.maxSizeMb, 10);
});

test('eligible files prefetch to cache, disabled or oversized files never fetch', async () => {
  const settings = await store();
  const cached = new Map<string, Response>();
  const requests: string[] = [];
  const cache = {
    match: async (url: string) => cached.get(url),
    put: async (url: string, response: Response) => {
      cached.set(url, response);
    },
  };
  Object.assign(globalThis.window, { caches: { open: async () => cache } });
  const originalHttp = globalThis.$http;
  globalThis.$http = async (input: string) => {
    requests.push(input);
    return new Blob(['file data']);
  };
  try {
    assert.equal(await settings.prefetch(document, 'https://storage.example/document.pdf'), true);
    assert.equal(await settings.prefetch(document, 'https://storage.example/document.pdf'), true);
    assert.equal(requests.length, 1);
    assert.equal(await cached.get('https://storage.example/document.pdf')!.text(), 'file data');
    settings.updateProfile('mobile', { files: { enabled: false } });
    assert.equal(await settings.prefetch(document, 'https://storage.example/disabled.pdf'), false);
    settings.updateProfile('mobile', { files: { enabled: true, maxSizeMb: 1 } });
    assert.equal(await settings.prefetch(document, 'https://storage.example/large.pdf'), false);
    assert.equal(requests.length, 1);
  } finally {
    globalThis.$http = originalHttp;
  }
});

test('account switch aborts pending file prefetch and prevents stale cache writes', async () => {
  const settings = await store();
  const writes: string[] = [];
  Object.assign(globalThis.window, {
    caches: {
      open: async () => ({
        match: async () => undefined,
        put: async (url: string) => {
          writes.push(url);
        },
      }),
    },
  });
  const originalHttp = globalThis.$http;
  let resolve!: (response: Blob) => void;
  let signal!: AbortSignal;
  globalThis.$http = async (_input: string, options: { signal: AbortSignal }) => {
    signal = options!.signal as AbortSignal;
    return new Promise<Blob>((done) => {
      resolve = done;
    });
  };
  try {
    const pending = settings.prefetch(document, 'https://storage.example/private.pdf');
    await new Promise((done) => setImmediate(done));
    auth.user.id = 'b';
    assert.equal(signal.aborted, true);
    resolve(new Blob(['private file']));
    assert.equal(await pending, false);
    assert.deepEqual(writes, []);
  } finally {
    globalThis.$http = originalHttp;
  }
});

test('turning auto-download off aborts the active prefetch', async () => {
  const settings = await store();
  Object.assign(globalThis.window, {
    caches: {
      open: async () => ({
        match: async () => undefined,
        put: async () => {
          throw new Error('must not cache');
        },
      }),
    },
  });
  const originalHttp = globalThis.$http;
  let resolve!: (response: Blob) => void;
  let signal!: AbortSignal;
  globalThis.$http = async (_input: string, options: { signal: AbortSignal }) => {
    signal = options.signal;
    return new Promise<Blob>((done) => {
      resolve = done;
    });
  };
  try {
    const pending = settings.prefetch(document, 'https://storage.example/stopped.pdf');
    await new Promise((done) => setImmediate(done));
    settings.updateProfile('mobile', { enabled: false });
    assert.equal(signal.aborted, true);
    resolve(new Blob(['file']));
    assert.equal(await pending, false);
  } finally {
    globalThis.$http = originalHttp;
  }
});

test('VueUse offline and data-saver state pause auto-download, without inferring Wi-Fi from 4g', async () => {
  const settings = await store();
  connection.effectiveType = '4g';
  connection.dispatchEvent(new Event('change'));
  await nextTick();
  assert.equal(settings.activeProfile, 'mobile');
  browserNavigator.onLine = false;
  browserWindow.dispatchEvent(new Event('offline'));
  await nextTick();
  assert.equal(settings.canAutoLoad(photo), false);
  browserNavigator.onLine = true;
  browserWindow.dispatchEvent(new Event('online'));
  await nextTick();
  assert.equal(settings.canAutoLoad(photo), true);
  connection.saveData = true;
  connection.dispatchEvent(new Event('change'));
  await nextTick();
  assert.equal(settings.canAutoLoad(photo), false);
});

test('legacy manual profile preference is ignored and edits no longer persist it', async () => {
  const settings = await store();
  saved.set('octo:media-auto-download:v1:b', JSON.stringify({ selection: 'wifi' }));
  auth.user.id = 'b';
  await nextTick();
  assert.equal(settings.detectedProfile, null);
  assert.equal(settings.activeProfile, 'mobile');
  settings.updateProfile('mobile', { enabled: false });
  assert.equal('selection' in JSON.parse(saved.get('octo:media-auto-download:v1:b')!), false);
});
