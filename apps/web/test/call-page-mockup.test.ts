import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc';
import ts from 'typescript';

const files = [
  '../app/pages/calls/room/[username].vue',
  '../app/components/feature/calls/CallsLobby.vue',
  '../app/components/feature/calls/CallsRoom.vue',
].map((path) => {
  const filename = new URL(path, import.meta.url).pathname;
  return { filename, source: readFileSync(filename, 'utf8') };
});

for (const { filename, source } of files) {
  test(`${filename}: mockup initializes without browser APIs, stores or lifecycle effects`, () => {
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

  test(`${filename}: mockup has no operation handlers or two-way bindings`, () => {
    const { descriptor } = parse(source, { filename });
    assert.doesNotMatch(
      descriptor.template!.content,
      /(?:@(?:click|keydown)|v-on:|v-model|:ref=|\bref=)/,
    );
  });

  test(`${filename}: mockup script and template compile`, () => {
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
}

test('call screens retain preparation, participants and exit templates', () => {
  const templates = files
    .slice(1)
    .map(({ source }) => parse(source).descriptor.template!.content)
    .join('\n');
  for (const label of [
    'Камера',
    'Микрофон',
    'Ссылка-приглашение',
    'Подключиться',
    'Участники',
    'Выйти из звонка',
  ]) {
    assert.ok(templates.includes(label), label);
  }
  const page = parse(files[0].source).descriptor.template!.content;
  assert.match(page, /<CallsLobby\b/);
  assert.match(page, /<CallsRoom\b/);
});
