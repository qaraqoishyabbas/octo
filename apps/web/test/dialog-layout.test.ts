import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { compileTemplate, parse, type SFCTemplateBlock } from '@vue/compiler-sfc';
import {
  createSSRApp,
  defineComponent,
  h,
  mergeProps,
  resolveComponent,
  type Component,
} from 'vue';
import { renderToString, ssrRenderAttrs, ssrRenderComponent } from 'vue/server-renderer';

const readTemplate = async (relativePath: string) => {
  const filename = new URL(relativePath, import.meta.url);
  const source = await readFile(filename, 'utf8');
  const { descriptor } = parse(source, { filename: filename.pathname });
  assert.ok(descriptor.template);

  return { filename, template: descriptor.template };
};

const renderTemplate = async (
  relativePath: string,
  componentNames: string[],
  setup: () => Record<string, unknown> = () => ({}),
  components: Record<string, Component> = {},
) => {
  const { filename, template } = await readTemplate(relativePath);
  const compiled = compileTemplate({
    source: template.content,
    filename: filename.pathname,
    id: `dialog-layout-${relativePath}`,
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
    executable,
  )(resolveComponent, ssrRenderComponent, mergeProps, ssrRenderAttrs);
  const app = createSSRApp({ ssrRender, setup });

  for (const name of componentNames) {
    app.component(
      name,
      components[name] ??
        defineComponent({
          inheritAttrs: true,
          template: `<div data-component="${name}"></div>`,
        }),
    );
  }

  return renderToString(app);
};

const getStaticClasses = (template: SFCTemplateBlock) => {
  const classes: string[] = [];
  const visit = (node: { children?: unknown[]; props?: unknown[] }) => {
    for (const prop of node.props ?? []) {
      const attribute = prop as { type?: number; name?: string; value?: { content?: string } };
      if (attribute.type === 6 && attribute.name === 'class' && attribute.value?.content) {
        classes.push(attribute.value.content);
      }
    }

    for (const child of node.children ?? []) {
      if (typeof child === 'object' && child) {
        visit(child as { children?: unknown[]; props?: unknown[] });
      }
    }
  };

  visit(template.ast as { children?: unknown[]; props?: unknown[] });
  return classes.flatMap((value) => value.split(/\s+/));
};

test('uses the dialog itself as the only scrolling viewport', async () => {
  const html = await renderTemplate(
    '../app/components/feature/dialog/Dialog.vue',
    ['DialogLoading', 'DialogError', 'DialogList', 'DialogEmpty'],
    () => ({ dialog: { loading: false, current: {} } }),
  );

  assert.match(html, /^<div class="(?=[^"]*\boverflow-y-auto\b)[^"]*">/);
  assert.match(html, /<div class="(?=[^"]*\bmin-h-full\b)(?=[^"]*\bflex-col\b)[^"]*">/);
  assert.doesNotMatch(html, /\boverflow-hidden\b/);
});

test('keeps dialog controls and messages in one flowing column', async () => {
  const html = await renderTemplate('../app/components/feature/dialog/DialogList.vue', [
    'DialogApplicationBar',
    'DialogMessages',
    'DialogTextarea',
  ]);

  assert.doesNotMatch(html, /\boverflow-hidden\b/);
  assert.ok(html.indexOf('DialogApplicationBar') < html.indexOf('DialogMessages'));
  assert.ok(html.indexOf('DialogMessages') < html.indexOf('DialogTextarea'));
});

test('pins a short message list to the bottom of the available message area', async () => {
  const html = await renderTemplate(
    '../app/components/feature/dialog/DialogMessages.vue',
    [
      'DialogMessagesListLoading',
      'DialogMessagesListError',
      'DialogMessagesList',
      'DialogMessagesListEmpty',
    ],
    () => ({ messages: { loading: false, error: false, list: [{ id: 'message-1' }] } }),
  );

  assert.match(html, /^<div class="(?=[^"]*\bflex\b)(?=[^"]*\bflex-col\b)[^"]*">/);
  assert.match(
    html,
    /<div class="mt-auto"><div data-component="DialogMessagesList"><\/div><\/div>/,
  );
});

test('wires the initial message error retry to the history store', async () => {
  const html = await renderTemplate(
    '../app/components/feature/dialog/DialogMessages.vue',
    [
      'DialogMessagesListLoading',
      'DialogMessagesListError',
      'DialogMessagesList',
      'DialogMessagesListEmpty',
    ],
    () => ({
      messages: {
        loading: false,
        error: true,
        list: [],
        retryInitial: () => undefined,
      },
    }),
  );

  assert.match(html, /DialogMessagesListError/);
});

test('does not create a nested message-list scroller', async () => {
  const { template } = await readTemplate(
    '../app/components/feature/dialog/DialogMessagesList.vue',
  );
  const classes = getStaticClasses(template);

  assert.equal(classes.includes('overflow-y-auto'), false);
  assert.equal(classes.includes('overflow-hidden'), false);
  assert.equal(classes.includes('h-full'), false);
});

test('renders sticky dialog controls above message content', async () => {
  for (const component of ['DialogApplicationBar.vue', 'DialogTextarea.vue']) {
    const { template } = await readTemplate(`../app/components/feature/dialog/${component}`);
    const classes = getStaticClasses(template);

    assert.equal(classes.includes('sticky'), true);
    assert.equal(classes.includes('z-20'), true);
  }
});

test('uses the existing textarea subscribe button for channel subscription', async () => {
  let subscribed = false;
  const SubscribeButton = defineComponent({
    inheritAttrs: false,
    props: {
      label: String,
    },
    setup(props, { attrs }) {
      if (props.label === 'Подписаться' && typeof attrs.onClick === 'function') {
        attrs.onClick();
      }

      return () => h('button', { 'data-label': props.label });
    },
  });

  await renderTemplate(
    '../app/components/feature/dialog/DialogTextarea.vue',
    [
      'DialogDragDropOverlay',
      'DialogTextareaReference',
      'DialogTextareaUpload',
      'DialogTextEditor',
      'Item',
      'UAvatar',
      'UButton',
      'EmojiPicker',
    ],
    () => ({
      canWriteMessage: false,
      isDialogMember: false,
      isDraggingUploads: false,
      activeUploadDropZone: 'files',
      isSubscribing: false,
      dialog: { openSearch: () => undefined },
      subscribe: () => {
        subscribed = true;
      },
    }),
    { UButton: SubscribeButton },
  );

  assert.equal(subscribed, true);
});
