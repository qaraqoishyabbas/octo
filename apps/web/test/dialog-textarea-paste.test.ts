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
    overlay: { overlays: [] },
    DialogTextareaUploadModal: {},
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

function mountPasteListener(onPaste: (event: Event) => void) {
  const source = readFileSync(
    new URL('../app/components/feature/dialog/DialogTextarea.vue', import.meta.url),
    'utf8',
  );
  const script = parse(source).descriptor.scriptSetup!.content;
  const file = ts.createSourceFile('textarea.ts', script, ts.ScriptTarget.Latest, true);
  const hooks = file.statements.filter(
    (node) =>
      ts.isExpressionStatement(node) &&
      ts.isCallExpression(node.expression) &&
      ['onMounted', 'onBeforeUnmount'].includes(node.expression.expression.getText(file)) &&
      node.getText(file).includes('window.'),
  );
  const window = new EventTarget();
  const cleanup: Array<() => void> = [];
  const noop = () => {};
  const bindings = {
    window,
    onPaste,
    onMounted: (callback: () => void) => callback(),
    onBeforeUnmount: (callback: () => void) => cleanup.push(callback),
    saveActiveDraft: noop,
    onWindowDragEnter: noop,
    preventWindowFileDrop: noop,
    onWindowDragLeave: noop,
    onWindowDrop: noop,
  };
  const code = ts.transpileModule(hooks.map((node) => node.getText(file)).join('\n'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function(...Object.keys(bindings), code)(...Object.values(bindings));
  return { window, unmount: () => cleanup.forEach((callback) => callback()) };
}

test('pasting files without editor focus uploads once and stops after closing the dialog', () => {
  const { onPaste, uploads } = setup();
  const { window, unmount } = mountPasteListener(onPaste);
  const file = new File(['image'], 'screenshot.png', { type: 'image/png' });
  const paste = () => {
    const event = new Event('paste', { cancelable: true });
    Object.assign(event, { clipboardData: { files: [file], items: [] } });
    window.dispatchEvent(event);
    return event;
  };

  assert.equal(paste().defaultPrevented, true);
  assert.deepEqual(uploads, [{ files: [file], type: 'media' }]);
  unmount();
  assert.equal(paste().defaultPrevented, false);
  assert.equal(uploads.length, 1);
});

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
