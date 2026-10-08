import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parse } from '@vue/compiler-sfc';
import { createPinia, defineStore, setActivePinia } from 'pinia';
import { ref } from 'vue';

Object.assign(globalThis, {
  defineStore,
  ref,
  useDialogsStore: () => ({ list: [] }),
  useUsersOnlineStore: () => ({ setBackendLastSeen: () => {} }),
  useMessagesStore: () => ({ $reset: () => {} }),
});

const { useDialogStore } = await import('../app/stores/dialog.ts');

const readTemplateAst = async (relativePath: string) => {
  const filename = new URL(relativePath, import.meta.url);
  const source = await readFile(filename, 'utf8');
  const { descriptor } = parse(source, { filename: filename.pathname });
  assert.ok(descriptor.template);

  return descriptor.template.ast as { children?: unknown[]; props?: unknown[]; tag?: string };
};

const findSearchButton = (node: { children?: unknown[]; props?: unknown[]; tag?: string }) => {
  const props = (node.props ?? []) as Array<{
    type?: number;
    name?: string;
    arg?: { content?: string };
    value?: { content?: string };
    exp?: { content?: string };
  }>;

  if (
    node.tag === 'UButton' &&
    props.some(
      (prop) => prop.name === 'icon' && prop.value?.content === 'i-ph-magnifying-glass-bold',
    )
  ) {
    return node;
  }

  for (const child of node.children ?? []) {
    if (typeof child === 'object' && child) {
      const match = findSearchButton(
        child as { children?: unknown[]; props?: unknown[]; tag?: string },
      );
      if (match) {
        return match;
      }
    }
  }

  return null;
};

test('opens message search and closes it when the current dialog resets', () => {
  setActivePinia(createPinia());
  const dialog = useDialogStore();

  dialog.openSearch();
  assert.equal(dialog.searchOpen, true);

  dialog.$reset();
  assert.equal(dialog.searchOpen, false);
});

test('opens message search from the read-only textarea controls', async () => {
  const ast = await readTemplateAst('../app/components/feature/dialog/DialogTextarea.vue');
  const searchButton = findSearchButton(ast);
  assert.ok(searchButton);

  const clickHandler = (searchButton.props ?? []).find(
    (prop) =>
      (prop as { type?: number; name?: string; arg?: { content?: string } }).type === 7 &&
      (prop as { type?: number; name?: string; arg?: { content?: string } }).name === 'on' &&
      (prop as { type?: number; name?: string; arg?: { content?: string } }).arg?.content ===
        'click',
  ) as { exp?: { content?: string } } | undefined;

  assert.equal(clickHandler?.exp?.content, 'dialog.openSearch');
});
