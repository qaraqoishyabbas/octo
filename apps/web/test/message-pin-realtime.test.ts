import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

test('pin and unpin events update local messages without refreshing the dialog or history', async () => {
  const source = readFileSync(
    new URL('../app/plugins/websocket.client.ts', import.meta.url),
    'utf8',
  );
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const handlers = new Map<string, (payload: unknown) => void>();
  const updates: unknown[] = [];
  let refreshes = 0;
  const current = { id: 'internal-id', dialog_id: 'G-internal-id' };
  const bindings = {
    exports: {},
    require: () => ({ getDialogRealtimeChannel: () => null }),
    defineNuxtPlugin: (setup: () => void) => setup(),
    useAuthStore: () => ({ user: { id: 'me' } }),
    useWebSocketStore: () => ({
      on: (event: string, handler: (payload: unknown) => void) => handlers.set(event, handler),
    }),
    useDialogsStore: () => ({
      list: [],
      refreshById: async () => {
        refreshes++;
      },
    }),
    useDialogStore: () => ({ current }),
    useMessagesStore: () => ({ receiveMessageUpdate: (message: unknown) => updates.push(message) }),
    useUsersOnlineStore: () => ({}),
    useDialogTypingStore: () => ({}),
    watch: () => {},
    window: { addEventListener: () => {} },
  };
  new Function(...Object.keys(bindings), code)(...Object.values(bindings));
  for (const pinned of [true, false]) {
    handlers.get('dialog.message.pinned')!({
      dialog_id: current.id,
      dialog_public_id: current.dialog_id,
      message: { id: 'message-1', sender_id: 'me', is_pinned: pinned },
    });
    await Promise.resolve();
  }
  assert.equal(updates.length, 2);
  assert.equal(refreshes, 0);
  handlers.get('dialog.message.pinned')!({
    dialog_id: 'other-dialog',
    message: { id: 'other-message', is_pinned: true },
  });
  assert.equal(updates.length, 2);
});
