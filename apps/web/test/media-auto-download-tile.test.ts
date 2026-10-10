import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parse } from '@vue/compiler-sfc';
import { compile } from '@vue/compiler-dom';
import ts from 'typescript';
import * as Vue from 'vue';
import { renderToString } from '@vue/server-renderer';

async function tile(type: string, mounted = true) {
  const source = readFileSync(
    new URL(
      '../app/components/feature/dialog/DialogMessagesListItemMediaTile.vue',
      import.meta.url,
    ),
    'utf8',
  );
  const { descriptor } = parse(source);
  const props = Vue.reactive({
    item: {
      id: 'file-a',
      mime_type: type,
      original_name: 'photo',
      path: '/full',
      thumbnail_path: '/preview',
      size: 20,
      width: 100,
      height: 100,
    },
    loaded: false,
    openable: true,
    failed: false,
  });
  const policy = Vue.reactive({ allowed: false });
  const emitted: string[] = [];
  const mountCallbacks: (() => void)[] = [];
  const code = ts.transpileModule(descriptor.scriptSetup!.content, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const state = new Function(
    'exports',
    'defineProps',
    'defineEmits',
    'computed',
    'ref',
    'watch',
    'useMediaAutoDownloadStore',
    'onMounted',
    `${code}; return { props, open, loadAllowed, skeletonClass, durationLabel, sourceOf, emit };`,
  )(
    {},
    () => props,
    () => (event: string) => emitted.push(event),
    Vue.computed,
    Vue.ref,
    Vue.watch,
    () => ({ canAutoLoad: () => policy.allowed }),
    (callback: () => void) => mountCallbacks.push(callback),
  );
  if (mounted) mountCallbacks.forEach((callback) => callback());
  const render = new Function(
    'Vue',
    compile(descriptor.template!.content, { mode: 'function', prefixIdentifiers: true }).code,
  )(Vue);
  return {
    state,
    policy,
    emitted,
    mount: () => mountCallbacks.forEach((callback) => callback()),
    html: () => {
      const app = Vue.createSSRApp({ setup: () => ({ ...Vue.toRefs(props), ...state }), render });
      app.config.globalProperties.$storage = (path: string) => `https://storage.example${path}`;
      app.component('UIcon', { render: () => Vue.h('span') });
      app.component('UBadge', { render: () => Vue.h('span') });
      return renderToString(app);
    },
  };
}

test('disabled photo autoload emits no image URL, and manual open restores loading', async () => {
  const view = await tile('image/jpeg');
  assert.equal(view.state.loadAllowed.value, false);
  assert.doesNotMatch(await view.html(), /src=/);
  view.state.open({});
  assert.deepEqual(view.emitted, ['open']);
  assert.equal(view.state.loadAllowed.value, true);
  assert.match(await view.html(), /src="https:\/\/storage.example\/preview"/);
});

test('disabled video autoload removes src, poster and preload until policy allows it', async () => {
  const view = await tile('video/mp4');
  const disabled = await view.html();
  assert.doesNotMatch(disabled, /(?:src|poster)=/);
  assert.match(disabled, /preload="none"/);
  view.policy.allowed = true;
  const enabled = await view.html();
  assert.match(enabled, /src="https:\/\/storage.example\/full"/);
  assert.match(enabled, /poster="https:\/\/storage.example\/preview"/);
  assert.match(enabled, /preload="auto"/);
});

test('initial SSR and hydration emit no media URL before persisted settings are ready', async () => {
  const view = await tile('image/jpeg', false);
  view.policy.allowed = true;
  assert.doesNotMatch(await view.html(), /src=/);
  view.mount();
  assert.match(await view.html(), /src="https:\/\/storage.example\/preview"/);
});
