import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { createPinia, setActivePinia } from 'pinia';
import { computed, reactive, ref, watch } from 'vue';
import { compileScript, compileTemplate, parse } from '@vue/compiler-sfc';
import { useNetworkUsageStore } from '../app/stores/network-usage.ts';
import { estimatePayloadBytes } from '../app/utils/network-usage.ts';
import { formatStorageBytes } from '../app/utils/storage-usage.ts';
import { compile } from '@vue/compiler-dom';
import * as Vue from 'vue';
import { renderToString } from '@vue/server-renderer';

async function networkPanel() {
  const { store, auth } = setup();
  const source = readFileSync(
    new URL('../app/components/feature/setting/SettingDataNetwork.vue', import.meta.url),
    'utf8',
  );
  const { descriptor } = parse(source);
  const script = descriptor.scriptSetup!.content;
  const bindings = [...script.matchAll(/^const (\w+)/gm)].map((match) => match[1]);
  const code = ts.transpileModule(script, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  let confirmation: { onConfirm: () => void } | undefined;
  const state = new Function(
    'exports',
    'defineEmits',
    'useNetworkUsageStore',
    'useAuthStore',
    'useConfirm',
    'useToast',
    'computed',
    `${code}; return { ${bindings.join(', ')} };`,
  )(
    {},
    () => () => {},
    () => store,
    () => auth,
    () => ({
      confirm: (options: typeof confirmation) => {
        confirmation = options;
      },
    }),
    () => ({ add() {} }),
    computed,
  );
  const render = new Function(
    'Vue',
    compile(descriptor.template!.content, {
      mode: 'function',
      prefixIdentifiers: true,
    }).code,
  )(Vue);
  let resetButton: Record<string, any> | undefined;
  const html = () => {
    const app = Vue.createSSRApp({ setup: () => ({ ...state, formatStorageBytes }), render });
    for (const name of ['USlideover', 'AppBar', 'UButton', 'UIcon']) {
      app.component(name, {
        setup(_props, { attrs, slots }) {
          if (attrs.label === 'Сбросить статистику') resetButton = attrs;
          return () =>
            Vue.h(
              'div',
              Object.values(slots).flatMap((slot) => slot?.()),
            );
        },
      });
    }
    return renderToString(app);
  };
  return {
    store,
    html,
    reset: () => resetButton!.onClick(),
    confirm: () => confirmation!.onConfirm(),
  };
}

test('new network panel shows live received API plus media traffic and sent bytes', async () => {
  const view = await networkPanel();
  const attempt = view.store.beginAttempt('a'.repeat(1024));
  view.store.finishAttempt(attempt, 'b'.repeat(2048), true);
  view.store.recordMedia(4096, 'one', Date.now() + 100);
  let html = await view.html();
  assert.match(html, /Получено<\/span>\s*<div[^>]*>6\.0 КБ<\/div>/);
  assert.match(html, /Отправлено<\/span>\s*<div[^>]*>1\.0 КБ<\/div>/);
  view.store.recordMedia(1024, 'one', Date.now() + 100);
  html = await view.html();
  assert.match(html, /Получено<\/span>\s*<div[^>]*>7\.0 КБ<\/div>/);
});

test('new network reset button clears displayed counters only after confirmation', async () => {
  const view = await networkPanel();
  view.store.finishAttempt(view.store.beginAttempt('sent'), 'received', true);
  await view.html();
  view.reset();
  assert.equal(view.store.totalBytes, 12);
  view.confirm();
  assert.equal(view.store.totalBytes, 0);
  const html = await view.html();
  assert.match(html, /Получено<\/span>\s*<div[^>]*>0 Б<\/div>/);
  assert.match(html, /Отправлено<\/span>\s*<div[^>]*>0 Б<\/div>/);
});

function setup(saved = new Map<string, string>()) {
  setActivePinia(createPinia());
  const auth = reactive({ user: { id: 'one' } });
  Object.assign(globalThis, {
    useAuthStore: () => auth,
    window: {
      localStorage: {
        getItem: (key: string) => saved.get(key) ?? null,
        setItem: (key: string, value: string) => saved.set(key, value),
      },
    },
    computed,
    ref,
  });
  return { auth, saved, store: useNetworkUsageStore() };
}

test('estimates UTF-8 JSON, binary and multipart payload sizes without reading file data', () => {
  assert.equal(estimatePayloadBytes('Привет'), 12);
  assert.equal(
    estimatePayloadBytes({ text: 'я' }),
    new TextEncoder().encode(JSON.stringify({ text: 'я' })).length,
  );
  assert.equal(estimatePayloadBytes(new Uint8Array([1, 2, 3])), 3);
  const form = new FormData();
  form.append('caption', 'я');
  form.append('file', new Blob(['abcd']));
  assert.equal(estimatePayloadBytes(form), 6);
});

test('records each completed API attempt once and persists account statistics', () => {
  const { store, saved } = setup();
  const first = store.beginAttempt('ab');
  store.finishAttempt(first, 'xyz', true);
  store.finishAttempt(first, 'xyz', false);
  const failed = store.beginAttempt('a');
  store.finishAttempt(failed, undefined, false);
  assert.equal(store.state.sentBytes, 3);
  assert.equal(store.state.receivedBytes, 3);
  assert.equal(store.state.successfulRequests, 1);
  assert.equal(store.state.failedRequests, 1);
  assert.equal(store.totalBytes, 6);
  const restored = setup(saved).store;
  assert.equal(restored.totalBytes, 6);
  assert.equal(restored.state.failedRequests, 1);
});

test('late responses stay with their original account and reset excludes older requests', () => {
  const { store, auth } = setup();
  const old = store.beginAttempt('one');
  auth.user.id = 'two';
  store.finishAttempt(old, 'response', true);
  assert.equal(store.totalBytes, 0);
  auth.user.id = 'one';
  assert.equal(store.totalBytes, 11);
  const pending = store.beginAttempt('pending');
  store.reset();
  store.finishAttempt(pending, 'late', true);
  assert.equal(store.totalBytes, 0);
  assert.equal(store.state.successfulRequests, 0);
});

test('invalid saved counters and blocked persistence do not break tracking', () => {
  const saved = new Map([
    ['octo:network-usage:v1:one', '{"sentBytes":-1,"receivedBytes":null,"failedRequests":"bad"}'],
  ]);
  const { store } = setup(saved);
  assert.equal(store.totalBytes, 0);
  Object.assign(window.localStorage, {
    setItem: () => {
      throw new Error('blocked');
    },
  });
  assert.doesNotThrow(() => store.finishAttempt(store.beginAttempt('ok'), 'ok', true));
  assert.equal(store.totalBytes, 4);
});

test('HTTP hooks count successful and failed retries once, including external file downloads', async () => {
  const { store } = setup();
  const source = readFileSync(new URL('../app/plugins/app.ts', import.meta.url), 'utf8')
    .replaceAll('import.meta.server', 'false')
    .replaceAll('import.meta.client', 'true');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  let hooks: any;
  const bindings = {
    exports: {},
    defineNuxtPlugin: (callback: any) => callback({}),
    useToast: () => ({ add: () => {} }),
    useRuntimeConfig: () => ({ public: { apiBase: 'https://example.test', apiPrefix: '/api/v1' } }),
    useRequestURL: () => new URL('https://example.test'),
    useRequestHeaders: () => ({}),
    useCookie: () => ({ value: 'ru' }),
    useAuthStore: () => ({ token: 'test', reset: () => {} }),
    useNetworkUsageStore: () => store,
    $fetch: {
      create: (value: any) => {
        hooks = value;
      },
    },
  };
  new Function(...Object.keys(bindings), code)(...Object.values(bindings));
  const failed = { request: 'messages', options: { body: 'a' } };
  await hooks.onRequest(failed);
  const failureResponse = {
    ...failed,
    response: { status: 503, _data: 'no', statusText: 'Unavailable' },
  };
  await hooks.onResponse(failureResponse);
  await hooks.onResponseError(failureResponse);
  const retry = { request: 'messages', options: { body: 'a' } };
  await hooks.onRequest(retry);
  await hooks.onResponse({ ...retry, response: { status: 200, _data: 'yes' } });
  const file = { request: 'https://cdn.example.test/file', options: {} };
  await hooks.onRequest(file);
  await hooks.onResponse({ ...file, response: { status: 200, _data: new Blob(['abcd']) } });
  const offline = { request: 'messages', options: {} };
  await hooks.onRequest(offline);
  await hooks.onRequestError({ ...offline, error: new Error('offline') });
  assert.equal(store.state.sentBytes, 2);
  assert.equal(store.state.receivedBytes, 9);
  assert.equal(store.state.successfulRequests, 2);
  assert.equal(store.state.failedRequests, 2);
});

test('media transfers only count for their original account and after the last reset', () => {
  const { store, auth } = setup();
  const startedAt = Date.now() + 100;
  auth.user.id = 'two';
  store.recordMedia(1024, 'one', startedAt);
  assert.equal(store.totalBytes, 0);
  auth.user.id = 'one';
  assert.equal(store.state.mediaBytes, 1024);
  store.reset();
  store.recordMedia(1024, 'one', 0);
  assert.equal(store.totalBytes, 0);
});

test('browser media observer excludes API resources, hidden sizes and previous accounts', () => {
  const { store, auth } = setup();
  const source = readFileSync(
    new URL('../app/plugins/network-usage.client.ts', import.meta.url),
    'utf8',
  );
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  let callback: any;
  let cleanup: any;
  let disconnected = false;
  let time = 0;
  const bindings = {
    exports: {},
    defineNuxtPlugin: (plugin: any) =>
      plugin({
        vueApp: {
          onUnmount: (value: any) => {
            cleanup = value;
          },
        },
      }),
    useAuthStore: () => auth,
    useNetworkUsageStore: () => store,
    watch,
    performance: { now: () => time, timeOrigin: Date.now() + 1000 },
    PerformanceObserver: class {
      constructor(value: any) {
        callback = value;
      }
      observe() {}
      disconnect() {
        disconnected = true;
      }
    },
  };
  new Function(...Object.keys(bindings), code)(...Object.values(bindings));
  callback({
    getEntries: () => [
      { initiatorType: 'img', transferSize: 100, startTime: 1 },
      { initiatorType: 'fetch', transferSize: 500, startTime: 1 },
      { initiatorType: 'xmlhttprequest', transferSize: 600, startTime: 1 },
      { initiatorType: 'audio', transferSize: 0, startTime: 1 },
    ],
  });
  assert.equal(store.totalBytes, 100);
  time = 10;
  auth.user.id = 'two';
  callback({
    getEntries: () => [
      { initiatorType: 'video', transferSize: 200, startTime: 5 },
      { initiatorType: 'img', transferSize: 300, startTime: 11 },
    ],
  });
  assert.equal(store.totalBytes, 300);
  auth.user.id = 'one';
  assert.equal(store.totalBytes, 300);
  cleanup();
  assert.equal(disconnected, true);
});

test('network panel compiles and reset confirmation protects account switches', () => {
  const source = readFileSync(
    new URL('../app/components/feature/setting/SettingDataNetwork.vue', import.meta.url),
    'utf8',
  );
  const { descriptor } = parse(source);
  compileScript(descriptor, { id: 'network-panel' });
  assert.deepEqual(
    compileTemplate({
      source: descriptor.template!.content,
      filename: 'SettingDataNetwork.vue',
      id: 'network-panel',
    }).errors,
    [],
  );
  const file = ts.createSourceFile(
    'network-panel.ts',
    descriptor.scriptSetup!.content,
    ts.ScriptTarget.Latest,
    true,
  );
  const statement = file.statements.find(
    (node) =>
      ts.isVariableStatement(node) &&
      node.declarationList.declarations.some(
        (declaration) => declaration.name.getText(file) === 'requestReset',
      ),
  )!;
  const code = ts.transpileModule(statement.getText(file), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  let confirmation: any;
  let resets = 0;
  const auth = { user: { id: 'one' } };
  const reset = new Function('auth', 'confirm', 'usage', 'toast', `${code}; return requestReset;`)(
    auth,
    (value: any) => {
      confirmation = value;
    },
    { reset: () => resets++ },
    { add: () => {} },
  );
  reset();
  assert.equal(resets, 0);
  auth.user.id = 'two';
  confirmation.onConfirm();
  assert.equal(resets, 0);
  reset();
  confirmation.onConfirm();
  assert.equal(resets, 1);
});
