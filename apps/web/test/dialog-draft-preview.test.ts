import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parse } from '@vue/compiler-sfc';
import ts from 'typescript';
import { computed, ref } from 'vue';
import { useText } from '../app/composables/useText.ts';

test('reply-only drafts are visible, including empty editor HTML, and text stays preferred', () => {
  const draft = ref<{ content: string; replyMessage: { id: string } | null }>({
    content: '',
    replyMessage: { id: 'message-1' },
  });
  const source = readFileSync(
    new URL('../app/components/feature/dialogs/DialogsListItem.vue', import.meta.url),
    'utf8',
  );
  const code = ts.transpileModule(parse(source).descriptor.scriptSetup!.content, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const view = new Function(
    'exports',
    'defineProps',
    'computed',
    'watch',
    'useAuthStore',
    'useMessagesDraftStore',
    'useUsersOnlineStore',
    'useDialogTypingStore',
    'useText',
    `${code}
    return { hasDraft, draftPreview };
  `,
  )(
    {},
    () => ({ item: { dialog_id: 'D-1' } }),
    computed,
    () => {},
    () => ({ user: { id: 'user-1' } }),
    () => ({ getDraft: () => draft.value }),
    () => ({}),
    () => ({}),
    useText,
  );
  assert.equal(view.hasDraft.value, true);
  assert.equal(view.draftPreview.value, 'Ответить');
  draft.value.content = '<p><br></p>';
  assert.equal(view.draftPreview.value, 'Ответить');
  draft.value.content = '<p>Мой ответ</p>';
  assert.equal(view.draftPreview.value, 'Мой ответ');
  draft.value = { content: '', replyMessage: null };
  assert.equal(view.hasDraft.value, false);
});
