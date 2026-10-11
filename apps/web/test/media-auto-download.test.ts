import assert from 'node:assert/strict';
import test from 'node:test';
import { createPinia, setActivePinia, disposePinia } from 'pinia';
import { reactive, nextTick } from 'vue';
import { readFileSync } from 'node:fs';
import { parse } from '@vue/compiler-sfc';
import { compile } from '@vue/compiler-dom';
import * as Vue from 'vue';
import { renderToString } from '@vue/server-renderer';
import ts from 'typescript';

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
const video = { mime_type: 'video/mp4', type: 'media', size: 18 * 1024 ** 2 };
const document = { mime_type: 'application/pdf', type: 'file', size: 3 * 1024 ** 2 };

async function settingsControls(settings: Awaited<ReturnType<typeof store>>, profile = 'mobile') {
  const source = readFileSync(
    new URL('../app/components/feature/setting/SettingDataAutoDownload.vue', import.meta.url),
    'utf8',
  );
  const { descriptor } = parse(source);
  const script = descriptor.scriptSetup!.content;
  const bindings = [...script.matchAll(/^(?:const|function) (\w+)/gm)].map((match) => match[1]);
  const code = ts.transpileModule(script, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const state = new Function(
    'exports',
    'defineProps',
    'defineEmits',
    'computed',
    'useMediaAutoDownloadStore',
    `${code}; return { ${bindings.join(', ')} };`,
  )(
    {},
    () => ({ profile }),
    () => () => {},
    Vue.computed,
    () => settings,
  );
  const render = new Function(
    'Vue',
    compile(descriptor.template!.content, { mode: 'function', prefixIdentifiers: true }).code,
  )(Vue);
  const controls: Record<string, Record<string, any>> = {};
  const app = Vue.createSSRApp({ setup: () => state, render });
  for (const name of ['USlideover', 'AppBar', 'UButton', 'USwitch', 'USlider']) {
    app.component(name, {
      setup(_props, { attrs, slots }) {
        if (['UButton', 'USwitch', 'USlider'].includes(name) && !attrs.icon) controls[name] = attrs;
        return () =>
          Vue.h(
            'div',
            Object.values(slots).flatMap((slot) => slot?.()),
          );
      },
    });
  }
  await renderToString(app);
  return controls;
}

test('new accounts use medium mobile and high Wi-Fi auto-download limits', async () => {
  const settings = await store();
  assert.equal((await settingsControls(settings)).USlider.modelValue, 2);
  assert.equal((await settingsControls(settings, 'wifi')).USlider.modelValue, 3);
  assert.equal(settings.canAutoLoad({ ...video, size: 15 * 1024 ** 2 }), true);
  assert.equal(settings.canAutoLoad({ ...video, size: 16 * 1024 ** 2 }), false);
  assert.equal(settings.canAutoLoad(document), false);
  connection.type = 'wifi';
  connection.dispatchEvent(new Event('change'));
  assert.equal(settings.canAutoLoad({ ...video, size: 20 * 1024 ** 2 }), true);
  assert.equal(settings.canAutoLoad({ ...video, size: 21 * 1024 ** 2 }), false);
  assert.equal(settings.canAutoLoad({ ...photo, size: 15 * 1024 ** 2 }), true);
  assert.equal(settings.canAutoLoad({ ...photo, size: 16 * 1024 ** 2 }), false);
});

test('reset button restores both profiles and persists only the current account defaults', async () => {
  const settings = await store();
  settings.updateProfile('mobile', { enabled: false });
  const accountA = saved.get('octo:media-auto-download:v1:a');
  auth.user.id = 'b';
  settings.updateProfile('mobile', { enabled: false, photos: { maxSizeMb: 2 } });
  settings.updateProfile('wifi', { enabled: false, videos: { enabled: false } });
  const source = readFileSync(
    new URL('../app/components/feature/setting/SettingDataStorage.vue', import.meta.url),
    'utf8',
  );
  const { descriptor } = parse(source);
  const template = descriptor.template!.content;
  const script = ts.createSourceFile(
    'settings.ts',
    descriptor.scriptSetup!.content,
    ts.ScriptTarget.Latest,
    true,
  );
  const resetDeclaration = script.statements.find(
    (node) =>
      ts.isVariableStatement(node) &&
      node.declarationList.declarations.some(
        (declaration) => declaration.name.getText(script) === 'requestReset',
      ),
  );
  let confirmation: { onConfirm: () => void; onCancel?: () => void } | undefined;
  const code = ts.transpileModule(resetDeclaration?.getText(script) ?? '', {}).outputText;
  const requestReset = new Function(
    'auth',
    'confirm',
    'autoDownload',
    `${code}; return typeof requestReset === 'undefined' ? undefined : requestReset;`,
  )(
    auth,
    (options: typeof confirmation) => {
      confirmation = options;
    },
    settings,
  );
  const render = new Function(
    'Vue',
    compile(template, { mode: 'function', prefixIdentifiers: true }).code,
  )(Vue);
  let resetButton: Record<string, any> | undefined;
  const app = Vue.createSSRApp({
    setup: () => ({
      autoDownload: settings,
      requestReset,
      memory: { loading: false, totalUsage: 0 },
      network: { totalBytes: 0 },
      formatCacheUsage: () => '',
      formatStorageBytes: () => '',
    }),
    render,
  });
  for (const name of ['USlideover', 'AppBar', 'UButton']) {
    app.component(name, {
      setup(_props, { attrs, slots }) {
        if (attrs.label === 'Сбросить настройки') resetButton = attrs;
        return () =>
          Vue.h(
            'div',
            Object.values(slots).flatMap((slot) => slot?.()),
          );
      },
    });
  }
  await renderToString(app);
  assert.equal(typeof resetButton?.onClick, 'function');
  const before = JSON.stringify(settings.profiles);
  const savedBefore = saved.get('octo:media-auto-download:v1:b');
  resetButton!.onClick();
  assert.equal(JSON.stringify(settings.profiles), before);
  assert.equal(saved.get('octo:media-auto-download:v1:b'), savedBefore);
  assert.ok(confirmation);
  confirmation.onCancel?.();
  assert.equal(JSON.stringify(settings.profiles), before);
  auth.user.id = 'a';
  confirmation.onConfirm();
  assert.equal(settings.profiles.mobile.enabled, false);
  assert.equal(saved.get('octo:media-auto-download:v1:a'), accountA);
  auth.user.id = 'b';
  resetButton!.onClick();
  confirmation.onConfirm();
  assert.equal(settings.profiles.mobile.enabled, true);
  assert.equal(settings.profiles.wifi.enabled, true);
  assert.equal((await settingsControls(settings)).USlider.modelValue, 2);
  assert.equal((await settingsControls(settings, 'wifi')).USlider.modelValue, 3);
  assert.equal(settings.canAutoLoad({ ...video, size: 15 * 1024 ** 2 }), true);
  assert.equal(saved.get('octo:media-auto-download:v1:a'), accountA);
  disposePinia(activePinia!);
  activePinia = createPinia();
  setActivePinia(activePinia);
  const { useMediaAutoDownloadStore } = await import('../app/stores/media-auto-download.ts');
  const restored = useMediaAutoDownloadStore();
  assert.equal(restored.profiles.mobile.enabled, true);
  assert.equal(restored.profiles.mobile.photos.maxSizeMb, 10);
  assert.equal(restored.profiles.mobile.videos.maxSizeMb, 15);
  assert.equal(restored.profiles.wifi.videos.maxSizeMb, 20);
  auth.user.id = 'a';
  assert.equal(restored.profiles.mobile.enabled, false);
});

test('traffic slider applies the displayed media limits and restores the saved selection', async () => {
  const settings = await store();
  let controls = await settingsControls(settings);
  assert.equal(typeof controls.USlider['onUpdate:modelValue'], 'function');
  for (const [level, photoLimit, videoLimit] of [
    [1, 10, 0],
    [2, 10, 15],
    [3, 15, 20],
  ]) {
    controls.USlider['onUpdate:modelValue'](level);
    assert.equal(settings.canAutoLoad({ ...photo, size: photoLimit * 1024 ** 2 }), true);
    assert.equal(settings.canAutoLoad({ ...photo, size: (photoLimit + 1) * 1024 ** 2 }), false);
    assert.equal(
      settings.canAutoLoad({ ...video, size: Math.max(videoLimit, 1) * 1024 ** 2 }),
      level !== 1,
    );
    assert.equal(settings.canAutoLoad({ ...video, size: (videoLimit + 1) * 1024 ** 2 }), false);
    assert.equal(settings.canAutoLoad(document), false);
    assert.equal(settings.profiles.wifi.files.enabled, false);
    controls = await settingsControls(settings);
    assert.equal(controls.USlider.modelValue, level);
  }
  auth.user.id = 'b';
  auth.user.id = 'a';
  controls = await settingsControls(settings);
  assert.equal(controls.USlider.modelValue, 3);
  assert.equal(settings.canAutoLoad({ ...video, size: 20 * 1024 ** 2 }), true);
});

test('auto-download row toggles the profile and disables the slider without losing its level', async () => {
  const settings = await store();
  let controls = await settingsControls(settings, 'wifi');
  assert.equal(typeof controls.UButton.onClick, 'function');
  controls.UButton.onClick();
  assert.equal(settings.profiles.wifi.enabled, false);
  assert.equal(settings.profiles.mobile.enabled, true);
  controls = await settingsControls(settings, 'wifi');
  assert.equal(controls.USwitch['model-value'], false);
  assert.equal(controls.USlider.disabled, true);
  const level = controls.USlider.modelValue;
  controls.USlider['onUpdate:modelValue'](1);
  assert.equal((await settingsControls(settings, 'wifi')).USlider.modelValue, level);
  let stopped = false;
  controls.USwitch.onClick({
    stopPropagation() {
      stopped = true;
    },
  });
  assert.equal(stopped, true);
  assert.equal(settings.profiles.wifi.enabled, false);
  controls.USwitch['onUpdate:modelValue'](true);
  controls = await settingsControls(settings, 'wifi');
  assert.equal(settings.profiles.wifi.enabled, true);
  assert.equal(controls.USlider.disabled, false);
  assert.equal(controls.USlider.modelValue, level);
});

test('opaque photo cache is replaced with a readable body whose size can be measured', async () => {
  const settings = await store();
  let cached = { type: 'opaque', status: 0 } as Response;
  let requests = 0;
  Object.assign(globalThis.window, {
    caches: {
      open: async () => ({
        match: async () => cached,
        put: async (_url: string, response: Response) => {
          cached = response;
        },
      }),
    },
  });
  const originalHttp = globalThis.$http;
  globalThis.$http = async () => {
    requests++;
    return new Blob(['photo'], { type: 'image/png' });
  };
  try {
    assert.equal(await settings.prefetch(photo, 'https://api.example/storage/photo.png'), true);
    assert.equal(requests, 1);
    assert.equal(cached.status, 200);
    assert.equal((await cached.blob()).size, 5);
    await settings.prefetch(photo, 'https://api.example/storage/photo.png');
    assert.equal(requests, 1);
  } finally {
    globalThis.$http = originalHttp;
  }
});

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
  assert.equal(settings.canAutoLoad(document), false);
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
  settings.updateProfile('mobile', { files: { enabled: true } });
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
  settings.updateProfile('mobile', { files: { enabled: true } });
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
  settings.updateProfile('mobile', { files: { enabled: true } });
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

test('prefetch never admits partial 206 video responses as a full cached body', async () => {
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
  globalThis.$http = async (
    _url: string,
    options: { onFetchResponse: (context: { response: { status: number } }) => void },
  ) => {
    options.onFetchResponse?.({ response: { status: 206 } });
    return new Blob(['only a range'], { type: 'video/mp4' });
  };
  try {
    assert.equal(
      await settings.prefetch(
        { ...video, size: 1024 },
        'https://api.example/storage/messages/partial.mp4',
      ),
      false,
    );
    assert.deepEqual(writes, []);
  } finally {
    globalThis.$http = originalHttp;
  }
});

test('concurrent eligible consumers share one complete media prefetch', async () => {
  const settings = await store();
  const entries = new Map<string, Response>();
  let requests = 0;
  let finish!: () => void;
  const originalHttp = globalThis.$http;
  Object.assign(globalThis.window, {
    caches: {
      open: async () => ({
        match: async (url: string) => entries.get(url),
        put: async (url: string, response: Response) => {
          entries.set(url, response);
        },
      }),
    },
  });
  globalThis.$http = async () => {
    requests++;
    await new Promise<void>((done) => {
      finish = done;
    });
    return new Blob(['video full'], { type: 'video/mp4' });
  };
  try {
    const url = 'https://api.example/storage/messages/shared.mp4';
    const first = settings.prefetch({ ...video, size: 100 }, url);
    const second = settings.prefetch({ ...video, size: 100 }, url);
    await new Promise((done) => setImmediate(done));
    assert.equal(requests, 1);
    finish();
    assert.equal(await first, true);
    assert.equal(await second, true);
    assert.equal(await entries.get(url)!.text(), 'video full');
  } finally {
    globalThis.$http = originalHttp;
  }
});
