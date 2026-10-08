import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const workerSource = readFileSync(new URL('../public/push-sw.js', import.meta.url), 'utf8');

function createWorker(
  visibilityState: 'visible' | 'hidden',
  preferences: Record<string, boolean> | null = {
    enabled: true,
    show_text: true,
    show_names: true,
  },
) {
  const handlers = new Map<string, (event: any) => void>();
  const shown: Array<{ title: string; options: any }> = [];
  const badges: number[] = [];
  const notifications: Array<{ data: { dialog_id: string }; close: () => void }> = [];
  const client = {
    url: 'https://octo.example/@friend',
    visibilityState,
    navigate: async () => client,
    focus: async () => client,
  };
  const self = {
    location: { origin: 'https://octo.example' },
    navigator: { setAppBadge: async (count: number) => badges.push(count) },
    caches: {
      open: async () => ({
        match: async () => (preferences ? { json: async () => preferences } : undefined),
      }),
    },
    clients: {
      matchAll: async () => [client],
    },
    registration: {
      showNotification: async (title: string, options: any) => shown.push({ title, options }),
      getNotifications: async () => notifications,
    },
    addEventListener: (name: string, handler: (event: any) => void) => handlers.set(name, handler),
  };
  runInNewContext(workerSource, { self, URL });
  return { handlers, shown, notifications, badges };
}

async function push(worker: ReturnType<typeof createWorker>, data: Record<string, unknown> = {}) {
  let completed: Promise<unknown> | undefined;
  worker.handlers.get('push')?.({
    data: {
      json: () => ({
        title: 'Сообщение',
        body: 'Привет',
        data: { dialog_id: 'D-friend', message_id: 'message-1', url: '/@friend', ...data },
      }),
    },
    waitUntil: (promise: Promise<unknown>) => (completed = promise),
  });
  await completed;
}

test('does not display push while the app window is visible', async () => {
  const worker = createWorker('visible');
  await push(worker);
  assert.equal(worker.shown.length, 0);
});

test('applies local privacy and sound settings to background push', async () => {
  const worker = createWorker('hidden', {
    enabled: true,
    sound: false,
    show_text: false,
    show_names: false,
  });
  await push(worker);
  assert.equal(worker.shown[0]?.title, 'Новое уведомление');
  assert.equal(worker.shown[0]?.options.body, 'Содержимое скрыто');
  assert.equal(worker.shown[0]?.options.silent, true);
});

test('local mute and master settings suppress push', async () => {
  const muted = createWorker('hidden', { enabled: true, mentions_in_muted: true });
  await push(muted, { muted: true, mentioned: false });
  assert.equal(muted.shown.length, 0);

  const disabled = createWorker('hidden', { enabled: false });
  await push(disabled);
  assert.equal(disabled.shown.length, 0);
});

test('missing local settings do not expose a notification', async () => {
  const worker = createWorker('hidden', null);
  await push(worker);
  assert.equal(worker.shown.length, 0);
});

test('local settings allow mentions in muted dialogs and can disable the badge', async () => {
  const worker = createWorker('hidden', {
    enabled: true,
    mentions_in_muted: true,
    show_text: true,
    show_names: true,
    badge: false,
  });
  await push(worker, { muted: true, mentioned: true, badge: 4 });
  assert.equal(worker.shown.length, 1);
  assert.deepEqual(worker.badges, []);
});

test('displays background push with a dialog id for later dismissal', async () => {
  const worker = createWorker('hidden');
  await push(worker);
  assert.equal(worker.shown.length, 1);
  assert.equal(worker.shown[0]?.options.data.dialog_id, 'D-friend');
});

test('closes every delivered notification for the opened dialog', async () => {
  const { closeDialogNotifications } = await import('../app/utils/push-notifications.ts');
  const closed: string[] = [];
  const notification = (id: string, dialogId: string) => ({
    data: { dialog_id: dialogId },
    close: () => closed.push(id),
  });
  const registration = {
    getNotifications: async () => [
      notification('one', 'D-friend'),
      notification('two', 'D-friend'),
      notification('other', 'D-other'),
    ],
  };

  await closeDialogNotifications(registration, 'D-friend');
  assert.deepEqual(closed, ['one', 'two']);
});

test('clicking a push closes the other notifications from that dialog', async () => {
  const worker = createWorker('hidden');
  const closed: string[] = [];
  worker.notifications.push(
    { data: { dialog_id: 'D-friend' }, close: () => closed.push('same') },
    { data: { dialog_id: 'D-other' }, close: () => closed.push('other') },
  );
  let completed: Promise<unknown> | undefined;
  worker.handlers.get('notificationclick')?.({
    notification: {
      data: { dialog_id: 'D-friend', url: '/@friend' },
      close: () => closed.push('clicked'),
    },
    waitUntil: (promise: Promise<unknown>) => (completed = promise),
  });
  await completed;
  assert.deepEqual(closed, ['clicked', 'same']);
});
