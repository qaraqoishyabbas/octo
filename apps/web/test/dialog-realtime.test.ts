import assert from 'node:assert/strict';
import test from 'node:test';

test('does not authorize a direct dialog preview before the first message', async () => {
  const { getDialogRealtimeChannel } = await import('../app/utils/dialog-realtime.ts');
  assert.equal(
    getDialogRealtimeChannel({
      token: 'token',
      dialogId: 'D-user-id',
      type: 'D',
      role: null,
    }),
    null,
  );
});

test('subscribes a newly created direct dialog after the first message', async () => {
  const { getDialogRealtimeChannel } = await import('../app/utils/dialog-realtime.ts');
  assert.equal(
    getDialogRealtimeChannel({
      token: 'token',
      dialogId: 'D-user-id',
      type: 'D',
      role: null,
      messageId: 'first-message',
    }),
    'dialog.D-user-id',
  );
});

test('keeps an existing empty direct dialog subscribed', async () => {
  const { getDialogRealtimeChannel } = await import('../app/utils/dialog-realtime.ts');
  assert.equal(
    getDialogRealtimeChannel({
      token: 'token',
      dialogId: 'D-user-id',
      type: 'D',
      role: 'member',
    }),
    'dialog.D-user-id',
  );
});

test('subscribes a channel guest to the current dialog realtime channel', async () => {
  const realtime = await import('../app/utils/dialog-realtime.ts').catch(() => null);

  assert.ok(realtime);
  assert.equal(
    realtime.getDialogRealtimeChannel({
      token: 'token',
      dialogId: 'C-channel-id',
      type: 'C',
      role: null,
    }),
    'dialog.C-channel-id',
  );
});

test('does not duplicate channel events for a subscribed member', async () => {
  const realtime = await import('../app/utils/dialog-realtime.ts').catch(() => null);

  assert.ok(realtime);
  assert.equal(
    realtime.getDialogRealtimeChannel({
      token: 'token',
      dialogId: 'C-channel-id',
      type: 'C',
      role: 'member',
    }),
    null,
  );
});

test('preserves dialog realtime subscriptions outside channels', async () => {
  const realtime = await import('../app/utils/dialog-realtime.ts').catch(() => null);

  assert.ok(realtime);
  assert.equal(
    realtime.getDialogRealtimeChannel({
      token: 'token',
      dialogId: 'G-group-id',
      type: 'G',
      role: 'member',
    }),
    'dialog.G-group-id',
  );
});
