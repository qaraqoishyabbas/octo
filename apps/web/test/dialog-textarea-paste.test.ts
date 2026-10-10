import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parse } from '@vue/compiler-sfc';
import ts from 'typescript';
import { ref } from 'vue';

function pasteHandler(bindings: Record<string, unknown>) {
  const source = readFileSync(
    new URL('../app/components/feature/dialog/DialogTextarea.vue', import.meta.url),
    'utf8',
  );
  const script = parse(source).descriptor.scriptSetup!.content;
  const file = ts.createSourceFile('textarea.ts', script, ts.ScriptTarget.Latest, true);
  const statement = file.statements.find(
    (node) =>
      ts.isVariableStatement(node) &&
      node.declarationList.declarations.some(
        (declaration) => declaration.name.getText(file) === 'onPaste',
      ),
  );
  assert.ok(statement, 'composer must handle clipboard files');
  const code = ts.transpileModule(statement.getText(file), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return new Function(...Object.keys(bindings), `${code}; return onPaste;`)(
    ...Object.values(bindings),
  );
}

function setup({ editing = false, sending = false, writable = true } = {}) {
  const uploads: Array<{ files: File[]; type: string }> = [];
  const onPaste = pasteHandler({
    canWriteMessage: ref(writable),
    isEditingMessage: ref(editing),
    messages: { sending },
    isMediaFile: (file: File) => /^(image|video)\//.test(file.type),
    selectUploads: (files: File[], type: string) => uploads.push({ files, type }),
  });
  return { onPaste, uploads };
}

function clipboard(files: File[], items: unknown[] = []) {
  return {
    clipboardData: { files, items },
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
    stopPropagation() {},
  };
}

test('pasted images and videos open media upload instead of inserting clipboard HTML', () => {
  const { onPaste, uploads } = setup();
  const files = [
    new File(['image'], 'screenshot.png', { type: 'image/png' }),
    new File(['video'], 'clip.mp4', { type: 'video/mp4' }),
  ];
  const event = clipboard(files);
  onPaste(event);
  assert.equal(event.defaultPrevented, true);
  assert.deepEqual(uploads, [{ files, type: 'media' }]);
});

test('clipboard item files are used when FileList is empty', () => {
  const { onPaste, uploads } = setup();
  const file = new File(['image'], 'image.png', { type: 'image/png' });
  const event = clipboard(
    [],
    [
      { kind: 'file', getAsFile: () => file },
      { kind: 'file', getAsFile: () => null },
    ],
  );
  onPaste(event);
  assert.deepEqual(uploads, [{ files: [file], type: 'media' }]);
});

test('pasted documents use file upload', () => {
  const { onPaste, uploads } = setup();
  const files = [new File(['pdf'], 'doc.pdf', { type: 'application/pdf' })];
  onPaste(clipboard(files));
  assert.deepEqual(uploads, [{ files, type: 'file' }]);
});

test('plain text and unavailable uploads preserve normal paste behavior', () => {
  for (const options of [{}, { editing: true }, { sending: true }, { writable: false }]) {
    const { onPaste, uploads } = setup(options);
    const files = Object.keys(options).length
      ? [new File(['image'], 'image.png', { type: 'image/png' })]
      : [];
    const event = clipboard(files);
    onPaste(event);
    assert.equal(event.defaultPrevented, false);
    assert.deepEqual(uploads, []);
  }
});
