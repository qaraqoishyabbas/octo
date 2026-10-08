import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { compileScript, compileTemplate, parse } from '@vue/compiler-sfc';

async function files(directory: URL): Promise<URL[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const result: URL[] = [];
  for (const entry of entries) {
    const path = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
    if (entry.isDirectory()) result.push(...(await files(path)));
    else if (/\.(vue|ts)$/.test(entry.name)) result.push(path);
  }
  return result;
}

test('all web views and composables delegate HTTP transport to stores', async () => {
  for (const directory of [
    'components',
    'pages',
    'composables',
    'layouts',
    'middleware',
    'plugins',
  ]) {
    for (const file of await files(new URL(`../app/${directory}/`, import.meta.url))) {
      if (file.pathname.endsWith('/plugins/app.ts')) continue;
      const source = await readFile(file, 'utf8');
      assert.doesNotMatch(
        source,
        /\$(?:http|fetch)\s*[<(]|\buse(?:Http|LazyHttp|Fetch|LazyFetch|AsyncData)\s*[<(]|new XMLHttpRequest|\bfetch\s*\(/,
        file.pathname,
      );
    }
  }
});

test('all web Vue components and pages compile after extraction', async () => {
  for (const file of await files(new URL('../app/', import.meta.url))) {
    if (!file.pathname.endsWith('.vue')) continue;
    const source = await readFile(file, 'utf8');
    const { descriptor, errors } = parse(source, { filename: file.pathname });
    assert.deepEqual(errors, [], file.pathname);
    const script =
      descriptor.scriptSetup || descriptor.script
        ? compileScript(descriptor, { id: file.pathname })
        : null;
    if (!descriptor.template) continue;
    const template = compileTemplate({
      source: descriptor.template.content,
      filename: file.pathname,
      id: file.pathname,
      compilerOptions: { bindingMetadata: script?.bindings },
    });
    assert.deepEqual(template.errors, [], file.pathname);
  }
});
