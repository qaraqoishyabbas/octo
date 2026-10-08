import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc';
import ts from 'typescript';
import { computed, ref, reactive, watch, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { createLocalId } from '../app/utils/create-local-id.ts';
import * as mediaLayout from '../app/utils/messageMediaLayout.ts';

function setup(
  relativePath: string,
  props: object,
  bindings: Record<string, unknown>,
  returned: string,
) {
  const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
  const { descriptor } = parse(source);
  const code = ts.transpileModule(
    descriptor.scriptSetup!.content.replaceAll('import.meta.client', 'true'),
    {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    },
  ).outputText;
  const mounted: Array<() => unknown> = [];
  const unmounted: Array<() => unknown> = [];
  const events: unknown[][] = [];
  const toasts: unknown[] = [];
  const globals = {
    exports: {},
    require: (name: string) => {
      if (name === '~/utils/create-local-id') return { createLocalId };
      if (name === '~/utils/messageMediaLayout') return mediaLayout;
      throw new Error(`Unexpected import: ${name}`);
    },
    defineProps: () => props,
    withDefaults: (value: object, defaults: object) => ({ ...defaults, ...value }),
    defineEmits:
      () =>
      (...args: unknown[]) =>
        events.push(args),
    computed,
    ref,
    reactive,
    watch,
    nextTick,
    useTemplateRef: () => ref(null),
    onMounted: (callback: () => unknown) => mounted.push(callback),
    onBeforeUnmount: (callback: () => unknown) => unmounted.push(callback),
    useRuntimeConfig: () => ({ public: {} }),
    useToast: () => ({ add: (toast: unknown) => toasts.push(toast) }),
    ...bindings,
  };
  const state = new Function(...Object.keys(globals), `${code}\nreturn { ${returned} };`)(
    ...Object.values(globals),
  );
  return {
    state,
    events,
    toasts,
    mount: () => Promise.all(mounted.map((fn) => fn())),
    unmount: () => unmounted.forEach((fn) => fn()),
  };
}

const avatarPath = '../app/components/shared/AvatarUploader.vue';
const modalPath = '../app/components/feature/dialog/DialogTextareaUploadModal.vue';
const previewPath = '../app/components/feature/dialog/DialogTextareaUploadPreviews.vue';
const file = new File(['abc'], 'image.png', { type: 'image/png' });

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function uploadBoundary() {
  const pending: Array<ReturnType<typeof deferred<any>>> = [];
  const options: Array<{ signal: AbortSignal; onProgress: (value: number) => void }> = [];
  const deleted: string[] = [];
  const upload = (_file: File, requestOptions: (typeof options)[number]) => {
    const request = deferred<any>();
    pending.push(request);
    options.push(requestOptions);
    return request.promise;
  };
  return {
    pending,
    options,
    deleted,
    store: {
      revision: 0,
      uploadAvatar: upload,
      uploadMessageFile: upload,
      deleteTemporaryUpload: async (id: string) => {
        deleted.push(id);
      },
    },
  };
}

test('avatar replacement ignores stale progress/results and deletes unused temporary uploads', async () => {
  const boundary = uploadBoundary();
  const ui = setup(
    avatarPath,
    { modelValue: null },
    { useUploadsStore: () => boundary.store },
    'uploadAvatar, progress, loading',
  );
  const first = ui.state.uploadAvatar(file);
  await nextTick();
  const second = ui.state.uploadAvatar(file);
  await nextTick();
  assert.equal(boundary.options[0]!.signal.aborted, true);
  boundary.options[0]!.onProgress(88);
  assert.equal(ui.state.progress.value, 0);
  boundary.pending[0]!.resolve({ ok: true, id: 'stale', path: '/stale.png' });
  await first;
  assert.equal(ui.state.loading.value, true);
  assert.deepEqual(boundary.deleted, ['stale']);
  assert.deepEqual(ui.events, []);
  boundary.pending[1]!.resolve({ ok: true, id: 'current', path: '/current.png' });
  await second;
  assert.deepEqual(ui.events, [['update:modelValue', '/current.png']]);
  ui.unmount();
  assert.deepEqual(boundary.deleted, ['stale', 'current']);
});

test('avatar unmount aborts pending requests and cleans up a result already in flight', async () => {
  const boundary = uploadBoundary();
  const ui = setup(
    avatarPath,
    { modelValue: null },
    { useUploadsStore: () => boundary.store },
    'uploadAvatar',
  );
  const request = ui.state.uploadAvatar(file);
  await nextTick();
  ui.unmount();
  assert.equal(boundary.options[0]!.signal.aborted, true);
  boundary.pending[0]!.resolve({ ok: true, id: 'unused', path: '/unused.png' });
  await request;
  assert.deepEqual(boundary.deleted, ['unused']);
  assert.deepEqual(ui.events, []);
  assert.deepEqual(ui.toasts, []);
});

test('auth reset during avatar cleanup prevents a new upload and stale UI emissions', async () => {
  const boundary = uploadBoundary();
  const ui = setup(
    avatarPath,
    { modelValue: null },
    { useUploadsStore: () => boundary.store },
    'uploadAvatar',
  );
  const request = ui.state.uploadAvatar(file);
  boundary.store.revision += 1;
  await request;
  assert.equal(boundary.pending.length, 0);
  assert.deepEqual(ui.events, []);
  assert.deepEqual(ui.toasts, []);
});

function modal(boundary: ReturnType<typeof uploadBoundary>, sent = false) {
  return setup(
    modalPath,
    { files: [file] },
    {
      useUploadsStore: () => boundary.store,
      useMessagesStore: () => ({ send: async () => sent }),
    },
    'previews, uploadPreview, cancelUpload, retryUpload, removePreview, close, sendMessage',
  );
}

test('removing a modal preview aborts it and deletes a late successful upload', async () => {
  const boundary = uploadBoundary();
  const ui = modal(boundary);
  const preview = ui.state.previews[0];
  const request = ui.state.uploadPreview(file, preview);
  ui.state.removePreview(preview);
  assert.equal(boundary.options[0]!.signal.aborted, true);
  boundary.pending[0]!.resolve({ id: 'removed', path: '/removed.png' });
  await request;
  assert.deepEqual(boundary.deleted, ['removed']);
  assert.equal(ui.state.previews.length, 0);
  assert.deepEqual(ui.toasts, []);
});

test('modal cancel preserves retry state and validation errors stay local', async () => {
  const boundary = uploadBoundary();
  const ui = modal(boundary);
  const preview = ui.state.previews[0];
  const request = ui.state.uploadPreview(file, preview);
  boundary.options[0]!.onProgress(65);
  assert.equal(preview.progress, 65);
  ui.state.cancelUpload(preview);
  boundary.pending[0]!.reject(new DOMException('Upload aborted', 'AbortError'));
  await request;
  assert.equal(preview.uploading, false);
  assert.equal(preview.progress, 0);
  assert.ok(preview.error);
  assert.deepEqual(ui.toasts, []);
  ui.state.retryUpload(preview);
  boundary.pending[1]!.reject({ data: { errors: { file: ['Too large'] } } });
  await nextTick();
  assert.equal(preview.error, 'Too large');
  assert.equal(preview.abortController, undefined);
  assert.equal(ui.toasts.length, 1);
});

test('modal close/unmount cleans temporary uploads once; successful sends keep attached uploads', async () => {
  for (const sent of [false, true]) {
    const boundary = uploadBoundary();
    const ui = modal(boundary, sent);
    const request = ui.state.uploadPreview(file, ui.state.previews[0]);
    boundary.pending[0]!.resolve({ id: 'ready', path: '/ready.png', mime_type: 'image/png' });
    await request;
    if (sent) await ui.state.sendMessage();
    else ui.state.close();
    ui.unmount();
    assert.deepEqual(boundary.deleted, sent ? [] : ['ready']);
  }
});

test('cancelling a completed transport before its UI continuation releases the preview', async () => {
  const boundary = uploadBoundary();
  const ui = modal(boundary);
  const preview = ui.state.previews[0];
  const request = ui.state.uploadPreview(file, preview);
  boundary.pending[0]!.resolve({ id: 'cancelled', path: '/cancelled.png' });
  ui.state.cancelUpload(preview);
  await request;
  assert.deepEqual(boundary.deleted, ['cancelled']);
  assert.equal(preview.uploading, false);
  assert.equal(preview.abortController, undefined);
  assert.ok(preview.error);
});

test('download UI saves the store Blob, revokes its local URL and resets busy/error state', async () => {
  setActivePinia(createPinia());
  const { useFileDownloadsStore } = await import('../app/stores/file-downloads.ts');
  const store = useFileDownloadsStore();
  const source = readFileSync(
    new URL('../app/composables/useFileDownload.ts', import.meta.url),
    'utf8',
  );
  const code = ts.transpileModule(source.replaceAll('import.meta.client', 'true'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const request = deferred<Blob>();
  const urls: string[] = [];
  const blobs: Blob[] = [];
  const paths: string[] = [];
  const toasts: unknown[] = [];
  const dispose: Array<() => void> = [];
  let clicked = false;
  let removed = false;
  const link = {
    href: '',
    download: '',
    style: {},
    click: () => {
      clicked = true;
    },
    remove: () => {
      removed = true;
    },
  };
  const factory = new Function(
    'exports',
    'computed',
    'onScopeDispose',
    'useToast',
    'useFileDownloadsStore',
    'URL',
    'document',
    `${code}\nreturn useFileDownload();`,
  );
  const instance = () =>
    factory(
      {},
      computed,
      (callback: () => void) => dispose.push(callback),
      () => ({ add: (toast: unknown) => toasts.push(toast) }),
      () => store,
      {
        createObjectURL: (blob: Blob) => {
          blobs.push(blob);
          return 'blob:local';
        },
        revokeObjectURL: (url: string) => urls.push(url),
      },
      { createElement: () => link, body: { appendChild: () => {} } },
    );
  const httpGlobal = globalThis as typeof globalThis & { $http?: unknown };
  const originalHttp = httpGlobal.$http;
  Object.assign(globalThis, {
    $http: (url: string) => {
      paths.push(url);
      return request.promise;
    },
  });
  try {
    const download = instance();
    assert.equal(await download.downloadMessageFile({}), false);
    const result = download.downloadMessageFile({ id: '123', original_name: ' photo.png ' });
    assert.equal(download.downloadingKey.value, '123');
    assert.equal(download.loading.value, true);
    assert.equal(await download.downloadFile({ url: 'another' }), false);
    const blob = new Blob(['contents']);
    request.resolve(blob);
    assert.equal(await result, true);
    assert.deepEqual(paths, ['attachments/123/download']);
    assert.deepEqual(blobs, [blob]);
    assert.equal(link.download, 'photo.png');
    assert.equal(link.href, 'blob:local');
    assert.equal(clicked && removed, true);
    assert.deepEqual(urls, ['blob:local']);
    assert.equal(download.downloadingKey.value, null);
    assert.equal(download.loading.value, false);
    Object.assign(globalThis, {
      $http: async () => {
        throw new Error('offline');
      },
    });
    const failed = instance();
    assert.equal(await failed.downloadFile({ url: 'attachments/123/download' }), false);
    assert.equal(failed.downloadingKey.value, null);
    assert.match(failed.error.value.message, /offline/);
    assert.equal(toasts.length, 1);

    const pending = deferred<Blob>();
    Object.assign(globalThis, { $http: () => pending.promise });
    const cancelled = download.downloadFile({ url: 'attachments/stale/download' });
    store.$reset();
    pending.resolve(blob);
    assert.equal(await cancelled, false);
    assert.equal(blobs.length, 1);
    assert.equal(toasts.length, 1);
    assert.equal(download.error.value, null);
    dispose.forEach((callback) => callback());
    assert.deepEqual(store.scopes, {});
  } finally {
    Object.assign(globalThis, { $http: originalHttp });
  }
});

test('preview component keeps document mode, media dimensions, loading and viewer state', async () => {
  const media = reactive([
    {
      localId: 'media',
      name: 'photo.png',
      type: 'image/png',
      size: 3,
      id: 'ready',
      path: '/photo.png',
      width: 100,
      height: 200,
      uploading: false,
      progress: 100,
    },
  ]);
  const files = reactive([
    {
      localId: 'file',
      name: 'doc.pdf',
      type: 'application/pdf',
      size: 2048,
      uploading: true,
      progress: 40,
      error: undefined,
    },
  ]);
  const props = reactive({ media, files, loading: false });
  const ui = setup(
    previewPath,
    props,
    {},
    'mediaPreviews, filePreviews, mediaItemEntries, openMedia, isViewerOpen, markFailed, loaded, failed',
  );
  assert.equal(ui.state.mediaPreviews.value.length, 1);
  assert.equal(ui.state.filePreviews.value[0].progress, 40);
  assert.ok(Number.parseInt(ui.state.mediaItemEntries.value[0].style.height) > 0);
  ui.state.openMedia(media[0]);
  assert.equal(ui.state.isViewerOpen.value, true);
  ui.state.markFailed('media');
  assert.equal(ui.state.failed.value.media, true);
  props.media = [];
  await nextTick();
  assert.equal(ui.state.isViewerOpen.value, false);
  assert.deepEqual(ui.state.loaded.value, {});
  assert.deepEqual(ui.state.failed.value, {});
  props.files = [...files, ...media];
  assert.equal(ui.state.filePreviews.value.length, 2);
});

test('upload component scripts and templates compile', () => {
  for (const relativePath of [avatarPath, modalPath, previewPath]) {
    const filename = new URL(relativePath, import.meta.url).pathname;
    const source = readFileSync(filename, 'utf8');
    const { descriptor, errors } = parse(source, { filename });
    assert.deepEqual(errors, []);
    const script = compileScript(descriptor, { id: 'upload-test' });
    const template = compileTemplate({
      source: descriptor.template!.content,
      filename,
      id: 'upload-test',
      compilerOptions: { bindingMetadata: script.bindings },
    });
    assert.deepEqual(template.errors, []);
  }
});
