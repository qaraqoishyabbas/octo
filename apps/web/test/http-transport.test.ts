import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

test('HTTP transport preserves Headers overrides, bearer authentication and multipart method handling', async () => {
  const source = readFileSync(new URL('../app/plugins/app.ts', import.meta.url), 'utf8')
    .replaceAll('import.meta.server', 'false')
    .replaceAll('import.meta.client', 'true');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  let options: { onRequest: (context: any) => Promise<void> };
  new Function(
    'exports',
    'defineNuxtPlugin',
    'useToast',
    'useRuntimeConfig',
    'useRequestURL',
    'useRequestHeaders',
    'useCookie',
    'useAuthStore',
    '$fetch',
    'useNetworkUsageStore',
    code,
  )(
    {},
    (callback: (app: object) => unknown) => callback({}),
    () => ({ add: () => {} }),
    () => ({ public: { apiBase: 'https://example.test', apiPrefix: '/api/v1' } }),
    () => new URL('https://example.test'),
    () => ({}),
    () => ({ value: 'ru' }),
    () => ({ token: 'test-token' }),
    {
      create: (value: typeof options) => {
        options = value;
      },
    },
    () => ({ beginAttempt: () => null, finishAttempt: () => {} }),
  );
  const context = {
    request: 'attachments/file/download',
    options: {
      baseURL: '',
      headers: new Headers({ Accept: '*/*', 'X-Custom': 'preserved' }),
      credentials: undefined,
    },
  };
  await options!.onRequest(context);
  assert.equal(context.options.headers.get('Accept'), '*/*');
  assert.equal(context.options.headers.get('X-Custom'), 'preserved');
  assert.equal(context.options.headers.get('Authorization'), 'Bearer test-token');
  assert.equal(context.options.headers.get('Accept-Language'), 'ru');
  assert.equal(context.options.baseURL, 'https://example.test/api/v1');
  assert.equal(context.options.credentials, 'omit');
  const body = new FormData();
  const multipart = {
    request: 'account/update',
    options: { headers: new Headers(), body, method: 'PUT' },
  };
  await options!.onRequest(multipart);
  assert.equal(multipart.options.method, 'POST');
  assert.equal(body.get('_method'), 'PUT');
});
