import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { compileTemplate, parse } from '@vue/compiler-sfc';
import { createSSRApp, defineComponent, h, mergeProps, resolveComponent } from 'vue';
import {
  renderToString,
  ssrRenderAttrs,
  ssrRenderComponent,
  ssrRenderList,
} from 'vue/server-renderer';

test('renders every group user without a virtual-list window', async () => {
  const filename = new URL('../app/components/feature/group/GroupUserList.vue', import.meta.url);
  const source = await readFile(filename, 'utf8');
  const { descriptor } = parse(source, { filename: filename.pathname });
  assert.ok(descriptor.template);

  const compiled = compileTemplate({
    source: descriptor.template.content,
    filename: filename.pathname,
    id: 'group-user-list',
    ssr: true,
    ssrCssVars: [],
  });
  assert.deepEqual(compiled.errors, []);

  const executable = compiled.code
    .replace(/^import .*$/gm, '')
    .replace('export function ssrRender', 'return function ssrRender');
  const ssrRender = new Function(
    '_resolveComponent',
    '_ssrRenderComponent',
    '_mergeProps',
    '_ssrRenderAttrs',
    '_ssrRenderList',
    executable,
  )(resolveComponent, ssrRenderComponent, mergeProps, ssrRenderAttrs, ssrRenderList);
  const users = [
    { id: 'user-1', name: 'Алиса' },
    { id: 'user-2', name: 'Борис' },
  ];
  const app = createSSRApp({
    ssrRender,
    setup: () => ({
      contact: { list: users, loading: false, hasMore: true, total: users.length },
      disabledUserIdSet: new Set<string>(),
      emit: () => undefined,
      props: { selectedList: [] },
    }),
  });

  app.component(
    'GroupUserListItem',
    defineComponent({
      props: { user: { type: Object, required: true } },
      setup: (props) => () => h('div', { 'data-user-id': props.user.id }),
    }),
  );
  app.component('UBadge', defineComponent({ render: () => h('div') }));
  app.component('UIcon', defineComponent({ render: () => h('span') }));

  const html = await renderToString(app);

  assert.match(html, /data-user-id="user-1"/);
  assert.match(html, /data-user-id="user-2"/);
});
