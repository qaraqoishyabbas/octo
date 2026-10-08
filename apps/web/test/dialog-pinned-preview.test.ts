import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parse } from '@vue/compiler-sfc';
import ts from 'typescript';
import { computed, reactive, watch, nextTick, effectScope } from 'vue';

test('pinned toolbar loads the current member dialog and opens the existing slideover', async () => {
  const source = readFileSync(
    new URL('../app/components/feature/dialog/DialogApplicationBarPinned.vue', import.meta.url),
    'utf8',
  );
  const script = parse(source).descriptor.scriptSetup!.content;
  const code = ts.transpileModule(script, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const dialog = reactive({ current: { dialog_id: 'dialog-1', role: 'member' as string | null } });
  let loaded = 0;
  let opened = 0;
  const slideover = {};
  const messages = {
    latestPinnedMessage: { id: 'message-1' },
    fetchPinned: async () => {
      loaded++;
    },
  };
  const bindings = {
    exports: {},
    require: () => ({ DialogPinnedMessagesList: slideover }),
    computed,
    watch,
    useDialogStore: () => dialog,
    useMessagesStore: () => messages,
    useOverlay: () => ({
      create: (component: unknown) => {
        assert.equal(component, slideover);
        return {
          open: () => {
            opened++;
          },
        };
      },
    }),
  };
  const scope = effectScope();
  const ui = scope.run(() =>
    new Function(...Object.keys(bindings), `${code}; return { openPinnedMessages };`)(
      ...Object.values(bindings),
    ),
  );
  assert.equal(loaded, 1);
  ui.openPinnedMessages();
  assert.equal(opened, 1);
  dialog.current.dialog_id = 'dialog-2';
  await nextTick();
  assert.equal(loaded, 2);
  dialog.current.role = null;
  await nextTick();
  assert.equal(loaded, 2);
  scope.stop();
});
