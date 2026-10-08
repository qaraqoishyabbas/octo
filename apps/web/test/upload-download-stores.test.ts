import assert from 'node:assert/strict';
import test from 'node:test';
import { createPinia, setActivePinia } from 'pinia';

class UploadRequest {
  static requests: UploadRequest[] = [];
  upload = {
    onprogress: null as
      ((event: { lengthComputable: boolean; loaded: number; total: number }) => void) | null,
  };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  status = 200;
  statusText = '';
  responseText = '';
  headers: Record<string, string> = {};
  method = '';
  url = '';
  body?: FormData;
  aborted = false;
  constructor() {
    UploadRequest.requests.push(this);
  }
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }
  send(body: FormData) {
    this.body = body;
  }
  abort() {
    this.aborted = true;
    this.onabort?.();
  }
  respond(payload: unknown, status = 200) {
    this.status = status;
    this.responseText = JSON.stringify(payload);
    this.onload?.();
  }
}

const auth = { token: 'upload-token' as string | null };
const httpCalls: Array<{ path: string; options: unknown }> = [];
const downloadBlob = new Blob(['download']);
Object.assign(globalThis, {
  XMLHttpRequest: UploadRequest,
  useAuthStore: () => auth,
  useRuntimeConfig: () => ({ public: { apiBase: 'https://api.example', apiPrefix: '/v1' } }),
  $http: async (path: string, options: unknown) => {
    httpCalls.push({ path, options });
    return downloadBlob;
  },
});

const messageResponse = {
  id: 'temp-message',
  path: '/message.png',
  type: 'media',
  mime_type: 'image/png',
  original_name: 'image.png',
  size: 3,
  width: 10,
  height: 20,
  duration: null,
  thumbnail_path: '/thumb.png',
};
const file = new File(['abc'], 'image.png', { type: 'image/png' });

async function uploads() {
  setActivePinia(createPinia());
  UploadRequest.requests = [];
  httpCalls.length = 0;
  auth.token = 'upload-token';
  const { useUploadsStore } = await import('../app/stores/uploads.ts');
  return useUploadsStore();
}

test('avatar upload preserves multipart fields, auth and progress and detaches handlers', async () => {
  const store = await uploads();
  const progress: number[] = [];
  const controller = new AbortController();
  const result = store.uploadAvatar(file, {
    entity: 'avatars',
    width: 400,
    height: 200,
    signal: controller.signal,
    onProgress: (value: number) => progress.push(value),
  });
  const xhr = UploadRequest.requests[0]!;
  assert.equal(xhr.method, 'POST');
  assert.equal(xhr.url, 'https://api.example/v1/upload');
  assert.deepEqual(xhr.headers, {
    Accept: 'application/json',
    Authorization: 'Bearer upload-token',
  });
  assert.deepEqual(Array.from(xhr.body!.keys()), ['image', 'entity', 'width', 'height']);
  assert.equal((xhr.body!.get('image') as File).name, 'image.png');
  assert.equal(xhr.body!.get('entity'), 'avatars');
  assert.equal(xhr.body!.get('width'), '400');
  assert.equal(xhr.body!.get('height'), '200');
  xhr.upload.onprogress?.({ lengthComputable: false, loaded: 1, total: 3 });
  xhr.upload.onprogress?.({ lengthComputable: true, loaded: 3, total: 3 });
  xhr.respond({ ok: true, id: 'temp-avatar', path: '/avatar.png' });
  assert.deepEqual(await result, { ok: true, id: 'temp-avatar', path: '/avatar.png' });
  assert.deepEqual(progress, [99, 100]);
  assert.equal(xhr.onload, null);
  assert.equal(xhr.upload.onprogress, null);
  controller.abort();
  assert.equal(xhr.aborted, false);
});

test('message upload preserves file mode and response metadata without an auth token', async () => {
  const store = await uploads();
  auth.token = null;
  const result = store.uploadMessageFile(file, { type: 'file' });
  const xhr = UploadRequest.requests[0]!;
  assert.deepEqual(Array.from(xhr.body!.keys()), ['file', 'entity', 'type']);
  assert.equal(xhr.body!.get('entity'), 'messages');
  assert.equal(xhr.body!.get('type'), 'file');
  assert.deepEqual(xhr.headers, { Accept: 'application/json' });
  xhr.respond(messageResponse);
  assert.deepEqual(await result, messageResponse);
});

test('aborting one upload rejects it and leaves concurrent requests running', async () => {
  const store = await uploads();
  const controller = new AbortController();
  const cancelled = store.uploadMessageFile(file, { type: 'media', signal: controller.signal });
  const rejected = assert.rejects(cancelled, { name: 'AbortError' });
  const kept = store.uploadMessageFile(file, { type: 'media' });
  controller.abort();
  await rejected;
  assert.equal(UploadRequest.requests[0]!.aborted, true);
  assert.equal(UploadRequest.requests[0]!.onabort, null);
  assert.equal(UploadRequest.requests[1]!.aborted, false);
  UploadRequest.requests[1]!.respond(messageResponse);
  assert.deepEqual(await kept, messageResponse);
});

test('an already aborted upload never sends a request', async () => {
  const store = await uploads();
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    store.uploadMessageFile(file, { type: 'media', signal: controller.signal }),
    { name: 'AbortError' },
  );
  assert.equal(UploadRequest.requests.length, 0);
});

test('abort settles even without an XHR abort event, and send failures release listeners', async () => {
  const store = await uploads();
  const controller = new AbortController();
  const result = store.uploadMessageFile(file, { type: 'media', signal: controller.signal });
  const rejected = assert.rejects(result, { name: 'AbortError' });
  const xhr = UploadRequest.requests[0]!;
  xhr.abort = () => {
    xhr.aborted = true;
  };
  controller.abort();
  await rejected;
  assert.equal(xhr.onload, null);
  assert.equal(xhr.upload.onprogress, null);

  const original = UploadRequest.prototype.send;
  UploadRequest.prototype.send = () => {
    throw new Error('send failed');
  };
  const secondController = new AbortController();
  try {
    await assert.rejects(
      store.uploadMessageFile(file, { type: 'media', signal: secondController.signal }),
      /send failed/,
    );
    secondController.abort();
    assert.equal(UploadRequest.requests[1]!.aborted, false);
    assert.equal(UploadRequest.requests[1]!.onabort, null);
  } finally {
    UploadRequest.prototype.send = original;
  }
});

test('validation errors retain the message error payload and release abort listeners', async () => {
  const store = await uploads();
  const controller = new AbortController();
  const result = store.uploadMessageFile(file, { type: 'media', signal: controller.signal });
  const payload = { message: 'Invalid file', errors: { file: ['Too large'] } };
  const rejected = assert.rejects(result, (error: unknown) => {
    assert.deepEqual(error, { data: payload, status: 422 });
    return true;
  });
  const xhr = UploadRequest.requests[0]!;
  xhr.respond(payload, 422);
  await rejected;
  assert.deepEqual(store.error, { data: payload, status: 422 });
  assert.equal(store.loading, false);
  controller.abort();
  assert.equal(xhr.aborted, false);
});

test('malformed JSON and network failures reject and release request handlers', async () => {
  const store = await uploads();
  const malformed = store.uploadAvatar(file, { entity: 'avatars', width: 400, height: 400 });
  const malformedRejected = assert.rejects(malformed, Error);
  const first = UploadRequest.requests[0]!;
  first.responseText = 'not-json';
  first.onload?.();
  await malformedRejected;
  assert.equal(first.onload, null);
  const failed = store.uploadMessageFile(file, { type: 'media' });
  const failedRejected = assert.rejects(failed, Error);
  const second = UploadRequest.requests[1]!;
  second.onerror?.();
  await failedRejected;
  assert.equal(second.upload.onprogress, null);
});

test('temporary upload deletion is best effort', async () => {
  const store = await uploads();
  await store.deleteTemporaryUpload('temp-message');
  assert.deepEqual(httpCalls, [{ path: 'upload/temp-message', options: { method: 'DELETE' } }]);
  const original = globalThis.$http;
  Object.assign(globalThis, {
    $http: async () => {
      throw new Error('offline');
    },
  });
  try {
    await store.deleteTemporaryUpload('temp-message');
  } finally {
    Object.assign(globalThis, { $http: original });
  }
});

test('upload reset aborts every active request, clears state and permits new uploads', async () => {
  const store = await uploads();
  const first = store.uploadMessageFile(file, { type: 'media' });
  const second = store.uploadAvatar(file, { entity: 'avatars' });
  const staleLoad = UploadRequest.requests[0]!.onload!;
  const staleProgress = UploadRequest.requests[0]!.upload.onprogress!;
  const rejected = [
    assert.rejects(first, { name: 'AbortError' }),
    assert.rejects(second, { name: 'AbortError' }),
  ];
  assert.equal(store.loading, true);
  assert.equal(Object.keys(store.activeOperations).length, 2);
  UploadRequest.requests[0]!.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 2 });
  assert.equal(Object.values(store.activeOperations)[0]!.progress, 50);
  store.$reset();
  await Promise.all(rejected);
  staleLoad();
  staleProgress({ lengthComputable: true, loaded: 1, total: 2 });
  assert.equal(store.loading, false);
  assert.deepEqual(store.activeOperations, {});
  assert.equal(store.error, null);
  assert.ok(UploadRequest.requests.slice(0, 2).every((xhr) => xhr.aborted));
  const next = store.uploadMessageFile(file, { type: 'file' });
  UploadRequest.requests[2]!.respond(messageResponse);
  assert.deepEqual(await next, messageResponse);
});

test('upload reset rejects and deletes a response settled before the action continuation', async () => {
  const store = await uploads();
  const result = store.uploadMessageFile(file, { type: 'media' });
  const rejected = assert.rejects(result, { name: 'AbortError' });
  UploadRequest.requests[0]!.respond(messageResponse);
  store.$reset();
  await rejected;
  assert.deepEqual(httpCalls, [{ path: 'upload/temp-message', options: { method: 'DELETE' } }]);
  assert.equal(store.error, null);
});

test('file downloads request a Blob with wildcard Accept and propagate transport failures', async () => {
  setActivePinia(createPinia());
  httpCalls.length = 0;
  const { useFileDownloadsStore } = await import('../app/stores/file-downloads.ts');
  const store = useFileDownloadsStore();
  const scope = store.createScope();
  assert.equal(await store.downloadFile(scope, 'attachments/123/download'), downloadBlob);
  const signal = (httpCalls[0]!.options as { signal: AbortSignal }).signal;
  assert.ok(signal instanceof AbortSignal);
  assert.deepEqual(httpCalls, [
    {
      path: 'attachments/123/download',
      options: { headers: { Accept: '*/*' }, responseType: 'blob', signal },
    },
  ]);
  const original = globalThis.$http;
  Object.assign(globalThis, {
    $http: async () => {
      throw new Error('offline');
    },
  });
  try {
    await assert.rejects(store.downloadFile(scope, 'attachments/123/download'), /offline/);
    assert.equal(store.scopes[scope]!.loading, false);
    assert.equal(store.scopes[scope]!.downloadingKey, null);
    assert.match((store.scopes[scope]!.error as Error).message, /offline/);
  } finally {
    Object.assign(globalThis, { $http: original });
  }
});

test('download scopes run concurrently and reset prevents old results from changing new state', async () => {
  setActivePinia(createPinia());
  const { useFileDownloadsStore } = await import('../app/stores/file-downloads.ts');
  const store = useFileDownloadsStore();
  const firstScope = store.createScope();
  const secondScope = store.createScope();
  const pending: Array<{ resolve: (blob: Blob) => void; signal: AbortSignal }> = [];
  const original = globalThis.$http;
  Object.assign(globalThis, {
    $http: (_url: string, options: { signal: AbortSignal }) =>
      new Promise<Blob>((resolve) => {
        pending.push({ resolve, signal: options.signal });
      }),
  });
  try {
    const first = store.downloadFile(firstScope, 'attachments/a/download', 'a');
    const second = store.downloadFile(secondScope, 'attachments/b/download', 'b');
    assert.equal(store.scopes[firstScope]!.downloadingKey, 'a');
    assert.equal(store.scopes[secondScope]!.downloadingKey, 'b');
    await assert.rejects(store.downloadFile(firstScope, 'duplicate'), /unavailable/);
    store.$reset();
    assert.ok(pending.every((entry) => entry.signal.aborted));
    assert.ok(
      Object.values(store.scopes).every(
        (scope) => !scope.loading && scope.downloadingKey === null && scope.error === null,
      ),
    );
    const rejected = [
      assert.rejects(first, { name: 'AbortError' }),
      assert.rejects(second, { name: 'AbortError' }),
    ];
    const next = store.downloadFile(firstScope, 'attachments/new/download', 'new');
    pending[0]!.resolve(downloadBlob);
    pending[1]!.resolve(downloadBlob);
    await Promise.all(rejected);
    assert.equal(store.scopes[firstScope]!.downloadingKey, 'new');
    assert.equal(store.scopes[firstScope]!.loading, true);
    pending[2]!.resolve(downloadBlob);
    assert.equal(await next, downloadBlob);
    assert.equal(store.scopes[firstScope]!.loading, false);

    const released = store.downloadFile(secondScope, 'attachments/released/download');
    const releasedRejected = assert.rejects(released, { name: 'AbortError' });
    store.releaseScope(secondScope);
    assert.equal(pending[3]!.signal.aborted, true);
    pending[3]!.resolve(downloadBlob);
    await releasedRejected;
    assert.equal(store.scopes[secondScope], undefined);
  } finally {
    Object.assign(globalThis, { $http: original });
  }
});
