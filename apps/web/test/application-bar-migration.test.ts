import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import test from 'node:test';

const appRoot = new URL('../app', import.meta.url);

const collectVueFiles = async (dir: string): Promise<string[]> => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(dir, entry.name);

      if (entry.isDirectory()) {
        return collectVueFiles(path);
      }

      return entry.isFile() && entry.name.endsWith('.vue') ? [path] : [];
    }),
  );

  return files.flat();
};

const stripHtmlComments = (source: string) => source.replace(/<!--[\s\S]*?-->/g, '');

test('does not use the legacy ApplicationBar in app components', async () => {
  const files = await collectVueFiles(appRoot.pathname);
  const legacyUsages = [];

  for (const file of files) {
    const source = stripHtmlComments(await readFile(file, 'utf8'));

    if (/<\/?ApplicationBar\b/.test(source)) {
      legacyUsages.push(relative(appRoot.pathname, file));
    }
  }

  assert.deepEqual(legacyUsages, []);
});
