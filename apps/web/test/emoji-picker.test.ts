import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parse } from '@vue/compiler-sfc';
import ts from 'typescript';
import { computed, ref, shallowRef, nextTick, watch } from 'vue';

const editorPath = '../app/components/feature/dialog/DialogTextEditor.vue';
const textareaPath = '../app/components/feature/dialog/DialogTextarea.vue';

function method(path: string, name: string, bindings: Record<string, unknown>) {
  const source = parse(readFileSync(new URL(path, import.meta.url), 'utf8')).descriptor.scriptSetup!
    .content;
  const file = ts.createSourceFile('component.ts', source, ts.ScriptTarget.Latest, true);
  const statement = file.statements.find(
    (node) =>
      ts.isVariableStatement(node) &&
      node.declarationList.declarations.some(
        (declaration) => declaration.name.getText(file) === name,
      ),
  );
  assert.ok(statement, `Missing editor method ${name}`);
  const code = ts.transpileModule(statement.getText(file), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return new Function(...Object.keys(bindings), `${code}; return ${name};`)(
    ...Object.values(bindings),
  );
}

test('emoji insertion uses the editor selection and emits the normal content update', () => {
  const calls: unknown[] = [];
  const chain = {
    focus() {
      calls.push('focus');
      return this;
    },
    insertContent(value: unknown) {
      calls.push(value);
      return this;
    },
    run() {
      calls.push('run');
      return true;
    },
  };
  const editor = ref({ isEditable: true, chain: () => chain });
  const insertText = method(editorPath, 'insertText', { editor });
  assert.equal(insertText('😀'), true);
  assert.deepEqual(calls, ['focus', { type: 'text', text: '😀' }, 'run']);
  editor.value.isEditable = false;
  assert.equal(insertText('😀'), false);
  assert.equal(calls.length, 3);
  editor.value.isEditable = true;
  assert.equal(insertText(''), false);
  calls.length = 0;
  assert.equal(insertText('😀', false), true);
  assert.deepEqual(calls, [{ type: 'text', text: '😀' }, 'run']);
});

test('composer routes emoji selection to its editor, not to a separate text model', () => {
  const inserted: unknown[] = [];
  const insertEmoji = method(textareaPath, 'insertEmoji', {
    editorRef: ref({
      insertText: (emoji: string, focus: boolean) => inserted.push([emoji, focus]),
    }),
  });
  insertEmoji('👩🏽‍💻');
  insertEmoji('😀', false);
  assert.deepEqual(inserted, [
    ['👩🏽‍💻', true],
    ['😀', false],
  ]);
  const template = parse(readFileSync(new URL(textareaPath, import.meta.url), 'utf8')).descriptor
    .template!.content;
  assert.match(template, /<EmojiPicker\b[^>]*@select="insertEmoji"/);
  const source = readFileSync(new URL(editorPath, import.meta.url), 'utf8');
  assert.match(source, /defineExpose\(\{[^}]*\binsertText\b/s);
});

function pickerUI(load: (name: string) => Promise<unknown>, mobile = false) {
  const source = parse(
    readFileSync(new URL('../app/components/shared/EmojiPicker.vue', import.meta.url), 'utf8'),
  ).descriptor.scriptSetup!.content;
  const code = ts.transpileModule(source.replace(/import\('([^']+)'\)/g, "load('$1')"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const cleanup: Array<() => void> = [];
  const events: unknown[][] = [];
  let blurs = 0;
  const globals = {
    exports: {},
    load,
    ref,
    shallowRef,
    nextTick,
    watch,
    computed,
    require: () => ({
      useMediaQuery: () => ref(mobile),
      createReusableTemplate: () => [null, null],
    }),
    document: {
      activeElement: {
        blur() {
          blurs++;
        },
      },
    },
    HTMLElement: Object,
    defineProps: () => ({ disabled: false }),
    defineExpose: () => {},
    withDefaults: (value: object, defaults: object) => ({ ...defaults, ...value }),
    defineEmits:
      () =>
      (...args: unknown[]) =>
        events.push(args),
    useColorMode: () => ref('light'),
    onUnmounted: (fn: () => void) => cleanup.push(fn),
    onBeforeUnmount: (fn: () => void) => cleanup.push(fn),
  };
  const state = new Function(
    ...Object.keys(globals),
    `${code}; return { el, openPicker, openEmojiPicker, hideEmojiPicker, isLoading, loadError, toggleMobilePicker, closePicker };`,
  )(...Object.values(globals));
  return { state, events, blurs: () => blurs, unmount: () => cleanup.forEach((fn) => fn()) };
}

test('picker receives local data and selection emits native emoji and closes the popover', async () => {
  let options: any;
  let styles = '';
  class Picker {
    style = {};
    constructor(value: unknown) {
      options = value;
    }
    remove() {}
    injectStyles(value: string) {
      styles = value;
    }
  }
  const data = { emojis: {} };
  const i18n = { search: 'Поиск' };
  const ui = pickerUI(async (name) =>
    name === 'emoji-mart'
      ? { Picker, init: async () => {} }
      : { default: name.endsWith('ru.json') ? i18n : data },
  );
  const children: unknown[] = [];
  ui.state.el.value = { replaceChildren: (child: unknown) => children.push(child) };
  ui.state.openPicker.value = true;
  await ui.state.openEmojiPicker();
  assert.equal(options.data, data);
  assert.equal(options.i18n, i18n);
  assert.equal(children.length, 1);
  assert.match(styles, /background-color:\s*var\(--ui-bg-elevated\)/);
  assert.match(styles, /border-radius:\s*var\(--radius-md\)/);
  assert.match(styles, /var\(--ui-primary\)/);
  options.onEmojiSelect({ native: '😀' });
  assert.deepEqual(
    ui.events.filter((event) => event[0] === 'select'),
    [['select', '😀', true]],
  );
  assert.equal(ui.state.openPicker.value, false);
  ui.unmount();
});

test('mobile picker keeps the panel open and inserts without bringing back the keyboard', async () => {
  let options: any;
  const ui = pickerUI(
    async (name) =>
      name === 'emoji-mart'
        ? {
            Picker: class {
              style = {};
              injectStyles() {}
              remove() {}
              constructor(value: unknown) {
                options = value;
              }
            },
            init: async () => {},
          }
        : { default: {} },
    true,
  );
  ui.state.el.value = { replaceChildren() {} };
  ui.state.openPicker.value = true;
  await ui.state.openEmojiPicker();
  assert.equal(options.searchPosition, 'none');
  assert.equal(ui.blurs(), 1);
  options.onEmojiSelect({ native: '😀' });
  options.onEmojiSelect({ native: '👍' });
  assert.equal(ui.state.openPicker.value, true);
  assert.deepEqual(
    ui.events.filter((event) => event[0] === 'select'),
    [
      ['select', '😀', false],
      ['select', '👍', false],
    ],
  );
  ui.state.toggleMobilePicker();
  assert.equal(ui.state.openPicker.value, false);
  assert.equal(ui.events.at(-1)?.[0], 'keyboard');
  ui.unmount();
});

test('closing during lazy load prevents stale picker creation and clears loading', async () => {
  let resolve!: (value: unknown) => void;
  let created = 0;
  const pending = new Promise((yes) => {
    resolve = yes;
  });
  const ui = pickerUI((name) =>
    name === 'emoji-mart' ? pending : Promise.resolve({ default: {} }),
  );
  ui.state.el.value = { replaceChildren: () => {} };
  ui.state.openPicker.value = true;
  const opening = ui.state.openEmojiPicker();
  ui.state.openPicker.value = false;
  ui.state.hideEmojiPicker();
  resolve({
    Picker: class {
      constructor() {
        created++;
      }
    },
    init: async () => {},
  });
  await opening;
  assert.equal(created, 0);
  assert.equal(ui.state.isLoading.value, false);
  ui.unmount();
});

test('failed lazy imports clear pending state and allow retry', async () => {
  let failed = true;
  const ui = pickerUI(async (name) => {
    if (failed) throw new Error('Chunk unavailable');
    return name === 'emoji-mart'
      ? {
          Picker: class {
            style = {};
            remove() {}
            injectStyles() {}
          },
          init: async () => {},
        }
      : { default: {} };
  });
  ui.state.el.value = { replaceChildren: () => {} };
  ui.state.openPicker.value = true;
  await ui.state.openEmojiPicker();
  assert.equal(ui.state.isLoading.value, false);
  assert.equal(ui.state.loadError.value, true);
  failed = false;
  await ui.state.openEmojiPicker();
  assert.equal(ui.state.loadError.value, false);
  ui.unmount();
});
