import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

function runtimeRules() {
  const source = readFileSync(new URL('../nuxt.config.ts', import.meta.url), 'utf8').replaceAll(
    'import.meta.env',
    '{}',
  );
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const output = {} as {
    default?: { pwa: { workbox: { runtimeCaching: Array<{ urlPattern: RegExp; options: any }> } } };
  };
  new Function('exports', 'defineNuxtConfig', code)(output, (value: unknown) => value);
  return output.default!.pwa.workbox.runtimeCaching;
}

test('avatar and media URLs select distinct caches without overlap', () => {
  const rules = runtimeRules();
  const avatarUrl = 'https://api.example/storage/avatars/a/photo.png';
  const photoUrl = 'https://api.example/storage/messages/photo.png';
  const videoUrl = 'https://api.example/storage/messages/video.mp4';
  assert.equal(
    rules.find((rule) => rule.urlPattern.test(avatarUrl))!.options.cacheName,
    'avatars-cache',
  );
  const media = rules.find((rule) => rule.options.cacheName === 'storage-cache')!;
  assert.equal(media.urlPattern.test(avatarUrl), false);
  assert.equal(media.urlPattern.test(photoUrl), true);
  assert.equal(media.urlPattern.test(videoUrl), true);
  assert.equal(media.options.rangeRequests, true);
  assert.equal(media.options.cacheableResponse.statuses.includes(206), false);
  assert.equal(media.options.cacheableResponse.statuses.includes(404), false);
  assert.equal(media.options.cacheableResponse.statuses.includes(200), true);
  assert.equal(media.options.cacheableResponse.statuses.includes(0), true);
});

test('opaque cached videos bypass installed Workbox range slicing while readable full videos are sliced', async () => {
  const media = runtimeRules().find((rule) => rule.options.cacheName === 'storage-cache')!;
  const guard = media.options.plugins?.find((plugin: any) => plugin.cachedResponseWillBeUsed);
  assert.ok(guard, 'media cache must guard opaque bodies before range slicing');
  Object.assign(globalThis, { self: { __WB_DISABLE_DEV_LOGS: true } });
  const { RangeRequestsPlugin } = await import('workbox-range-requests/RangeRequestsPlugin.js');
  const rangePlugin = new RangeRequestsPlugin();
  const request = new Request('https://api.example/storage/video.mp4', {
    headers: { Range: 'bytes=0-2' },
  });
  const opaque = { type: 'opaque', status: 0, blob: async () => new Blob([]) } as Response;
  const guarded = await guard.cachedResponseWillBeUsed({ request, cachedResponse: opaque });
  assert.equal(guarded, null);
  assert.equal(
    await rangePlugin.cachedResponseWillBeUsed({ request, cachedResponse: guarded }),
    null,
  );
  assert.equal(await guard.cacheWillUpdate({ request, response: opaque }), null);
  const readable = new Response('abcdef');
  const full = await guard.cachedResponseWillBeUsed({ request, cachedResponse: readable });
  const partial = await rangePlugin.cachedResponseWillBeUsed({ request, cachedResponse: full });
  assert.equal(partial!.status, 206);
  assert.equal(await partial!.text(), 'abc');
  const imageRequest = new Request('https://api.example/storage/image.png');
  assert.equal(
    await guard.cachedResponseWillBeUsed({ request: imageRequest, cachedResponse: opaque }),
    opaque,
  );
  assert.equal(await guard.cacheWillUpdate({ request: imageRequest, response: opaque }), opaque);
  const videoRequest = new Request('https://api.example/storage/video.mp4');
  Object.defineProperty(videoRequest, 'destination', { value: 'video' });
  assert.equal(await guard.cacheWillUpdate({ request: videoRequest, response: opaque }), null);
});
