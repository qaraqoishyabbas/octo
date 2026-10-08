import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parse } from '@vue/compiler-sfc';
import ts from 'typescript';
import { ref } from 'vue';

const source = parse(
  readFileSync(
    new URL('../app/components/feature/setting/SettingNotifications.vue', import.meta.url),
    'utf8',
  ),
).descriptor.scriptSetup!.content;

function method(name: string, bindings: Record<string, unknown>) {
  const file = ts.createSourceFile('settings.ts', source, ts.ScriptTarget.Latest, true);
  const statement = file.statements.find(
    (node) => ts.isFunctionDeclaration(node) && node.name?.getText(file) === name,
  );
  assert.ok(statement);
  const code = ts.transpileModule(statement.getText(file), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return new Function(...Object.keys(bindings), `${code}; return ${name};`)(
    ...Object.values(bindings),
  );
}

test('browser unsubscribe still finishes if the old server token is missing', async () => {
  let unsubscribed = false;
  let removed = false;
  const subscribed = ref(true);
  const disable = method('disableBrowserPush', {
    supported: ref(true),
    busy: ref(false),
    error: ref(''),
    subscribed,
    localStorage: {
      getItem: () => 'old-token-id',
      removeItem: () => (removed = true),
    },
    notification: {
      deletePushToken: async () => {
        throw new Error('not found');
      },
    },
    registration: async () => ({
      pushManager: {
        getSubscription: async () => ({ unsubscribe: async () => (unsubscribed = true) }),
      },
    }),
  });

  await disable();
  assert.equal(unsubscribed, true);
  assert.equal(removed, true);
  assert.equal(subscribed.value, false);
});
