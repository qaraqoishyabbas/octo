import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc';
import ts from 'typescript';

const filename = new URL('../app/pages/calls/room/[username].vue', import.meta.url).pathname;
const source = readFileSync(filename, 'utf8');

test('call mockup initializes without browser APIs, stores or lifecycle effects', () => {
  const { descriptor } = parse(source, { filename });
  const code = ts.transpileModule(descriptor.scriptSetup!.content, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  assert.doesNotMatch(
    source,
    /\b(?:navigator|window|localStorage|sessionStorage|RTCPeerConnection|MediaStream|AudioContext|setTimeout|setInterval|onMounted|onBeforeUnmount|watch|useAuthStore|useWebSocketStore)\b/,
  );
  new Function('definePageMeta', 'useSeoMeta', code)(
    () => {},
    () => {},
  );
});

test('call mockup keeps UI without operation handlers or two-way bindings', () => {
  const { descriptor } = parse(source, { filename });
  assert.doesNotMatch(
    descriptor.template!.content,
    /(?:@(?:click|keydown)|v-on:|v-model|:ref=|\bref=)/,
  );
  for (const label of [
    'Камера',
    'Микрофон',
    'Ссылка-приглашение',
    'Подключиться',
    'Участники',
    'Выйти из звонка',
  ]) {
    assert.ok(descriptor.template!.content.includes(label), label);
  }
});

test('call mockup script and all template states compile', () => {
  const { descriptor, errors } = parse(source, { filename });
  assert.deepEqual(errors, []);
  const script = compileScript(descriptor, { id: 'call-mockup-test' });
  const template = compileTemplate({
    source: descriptor.template!.content,
    filename,
    id: 'call-mockup-test',
    compilerOptions: { bindingMetadata: script.bindings },
  });
  assert.deepEqual(template.errors, []);
});
