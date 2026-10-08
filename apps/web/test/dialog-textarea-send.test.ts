import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parse } from '@vue/compiler-sfc';
import ts from 'typescript';
import { ref } from 'vue';

const source = readFileSync(
  new URL('../app/components/feature/dialog/DialogTextarea.vue', import.meta.url),
  'utf8',
);

function sendMethod(bindings: Record<string, unknown>) {
  const script = parse(source).descriptor.scriptSetup!.content;
  const file = ts.createSourceFile('textarea.ts', script, ts.ScriptTarget.Latest, true);
  const statement = file.statements.find(
    (node) =>
      ts.isVariableStatement(node) &&
      node.declarationList.declarations.some(
        (declaration) => declaration.name.getText(file) === 'send',
      ),
  );
  assert.ok(statement);
  const code = ts.transpileModule(statement.getText(file), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return new Function(...Object.keys(bindings), `${code}; return send;`)(
    ...Object.values(bindings),
  );
}

test('composer remains editable and does not spin while a message is being sent', () => {
  const template = parse(source).descriptor.template!.content;
  assert.match(template, /:editable="canWriteMessage && !editingMessageSaving"/);
  assert.match(template, /:loading="editingMessageSaving"/);
});

test('a failed send keeps both the failed message and text typed during the request', async () => {
  let finish!: (value: null) => void;
  const pending = new Promise<null>((resolve) => (finish = resolve));
  const messageHtml = ref('<p>Первое</p>');
  const messageText = ref('Первое');
  const restored: string[] = [];
  const send = sendMethod({
    canSubmit: ref(true),
    editingMessage: ref(null),
    messageHtml,
    messageText,
    silentMessage: ref(false),
    stopTypingSignal: () => {},
    dialog: { current: { dialog_id: 'D-one' } },
    editorRef: ref({
      clearContent: () => {
        messageHtml.value = '';
        messageText.value = '';
      },
      closeMentionSuggestions: () => {},
    }),
    drafts: { remove: () => {} },
    draftScope: ref({ userId: 'U-one', dialogId: 'D-one' }),
    messages: { send: () => pending },
    restoreDraft: (html: string) => restored.push(html),
    nextTick: async () => {},
    focusEditor: () => {},
  });

  const sending = send();
  messageHtml.value = '<p>Следующее</p>';
  messageText.value = 'Следующее';
  finish(null);
  await sending;

  assert.equal(restored.length, 1);
  assert.match(restored[0], /Первое/);
  assert.match(restored[0], /Следующее/);
});

test('a failed send restores the old dialog draft after navigation without losing the next draft', async () => {
  let finish!: (value: null) => void;
  const pending = new Promise<null>((resolve) => (finish = resolve));
  const messageHtml = ref('<p>Первое</p>');
  const messageText = ref('Первое');
  const draftScope = ref({ userId: 'U-one', dialogId: 'D-one' });
  const saved: Array<{ content: string; dialogId: string }> = [];
  const send = sendMethod({
    canSubmit: ref(true),
    editingMessage: ref(null),
    messageHtml,
    messageText,
    silentMessage: ref(false),
    stopTypingSignal: () => {},
    dialog: { current: { dialog_id: 'D-one' } },
    editorRef: ref({
      clearContent: () => {
        messageHtml.value = '';
        messageText.value = '';
      },
      closeMentionSuggestions: () => {},
    }),
    drafts: {
      remove: () => {},
      getDraft: () => ({ content: '<p>Следующее</p>', replyMessage: null }),
      set: (draft: { content: string; dialogId: string }) => saved.push(draft),
    },
    draftScope,
    messages: { send: () => pending },
    restoreDraft: () => assert.fail('Must not overwrite the new dialog'),
    nextTick: async () => {},
    focusEditor: () => {},
  });

  const sending = send();
  draftScope.value = { userId: 'U-one', dialogId: 'D-two' };
  finish(null);
  await sending;

  assert.equal(saved.length, 1);
  assert.equal(saved[0].dialogId, 'D-one');
  assert.match(saved[0].content, /Первое/);
  assert.match(saved[0].content, /Следующее/);
});
