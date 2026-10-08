import assert from 'node:assert/strict';
import test from 'node:test';
import { createPinia, setActivePinia } from 'pinia';
import { computed, ref } from 'vue';
import { useDevicesStore } from '../app/stores/devices.ts';
import { useChannelsStore } from '../app/stores/channels.ts';
import { useInvitationsStore } from '../app/stores/invitations.ts';
import { useMessagesSearchStore } from '../app/stores/messages-search.ts';

Object.assign(globalThis, { ref, computed });
function fresh(http: (path: string, options?: any) => Promise<any>) {
  setActivePinia(createPinia());
  Object.assign(globalThis, { $http: http });
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (failure: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

test('devices separate current session, encode keys, refresh after disconnect and preserve only current on disconnectOthers', async () => {
  const calls: { path: string; method?: string }[] = [];
  let sessions = [
    { key: 'current', is_current: true },
    { key: 'other/+', is_current: false },
  ];
  fresh(async (path, options) => {
    calls.push({ path, method: options?.method });
    if (options?.method === 'DELETE') {
      sessions = sessions.filter((item) => item.is_current);
      return { ok: true };
    }
    return { ok: true, devices: sessions };
  });
  const devices = useDevicesStore();
  await devices.fetchData();
  assert.equal(devices.currentDevice?.key, 'current');
  assert.equal(devices.otherDevices.length, 1);
  assert.equal(await devices.disconnect('other/+'), true);
  assert.deepEqual(calls[1], { path: 'devices/other%2F%2B', method: 'DELETE' });
  assert.equal(devices.otherDevices.length, 0);
  assert.equal(await devices.disconnectOthers(), true);
  assert.deepEqual(calls[3], { path: 'devices', method: 'DELETE' });
  assert.equal(devices.disconnecting, false);
});

test('device errors allow retry, reset invalidates late results, duplicate disconnects are blocked', async () => {
  fresh(async () => {
    throw new Error('offline');
  });
  const devices = useDevicesStore();
  await devices.fetchData();
  assert.equal(devices.error, true);
  assert.equal(devices.loading, false);
  const pending = deferred<any>();
  Object.assign(globalThis, { $http: () => pending.promise });
  const request = devices.disconnect('other');
  assert.equal(await devices.disconnectOthers(), false);
  devices.$reset();
  pending.resolve({ ok: true });
  assert.equal(await request, false);
  assert.deepEqual(devices.list, []);
  assert.equal(devices.error, false);
});

test('channel pagination deduplicates and search invalidation blocks an older response during debounce', async () => {
  fresh(async (_path, options) => ({
    channels: [{ id: 'one' }, { id: `page-${options.query.page}` }],
    has_more: options.query.page === 1,
    total: 3,
  }));
  const channels = useChannelsStore();
  await channels.fetchData();
  await channels.fetchData();
  assert.deepEqual(
    channels.list.map((item) => item.id),
    ['one', 'page-1', 'page-2'],
  );
  const pending = deferred<any>();
  Object.assign(globalThis, { $http: () => pending.promise });
  channels.searchQuery = 'old';
  const search = channels.fetchSearchData();
  channels.searchQuery = 'new';
  channels.invalidateSearch();
  pending.resolve({ channels: [{ id: 'old' }] });
  await search;
  assert.deepEqual(channels.searchList, []);
  assert.equal(channels.searchLoading, true);
  channels.closeSearch();
  assert.equal(channels.searchLoading, false);
});

test('invitation navigation and joining ignore previous tokens and support retry', async () => {
  const pending = deferred<any>();
  fresh(async () => pending.promise);
  const invitations = useInvitationsStore();
  const first = invitations.fetchData('old');
  Object.assign(globalThis, {
    $http: async () => ({ ok: true, dialog: { dialog_id: 'new', is_member: false } }),
  });
  await invitations.fetchData('new');
  pending.resolve({ ok: true, dialog: { dialog_id: 'old' } });
  await first;
  assert.equal(invitations.current?.dialog_id, 'new');
  Object.assign(globalThis, {
    $http: async () => {
      throw new Error('offline');
    },
  });
  assert.equal(await invitations.join(), null);
  assert.equal(invitations.joinError, true);
  assert.equal(invitations.joining, false);
  Object.assign(globalThis, { $http: async () => ({ ok: true, dialog_id: 'new' }) });
  assert.equal(await invitations.join(), 'new');
  assert.equal(invitations.current?.is_member, true);
});

test('message search invalidation aborts a stale request without navigating to its result', async () => {
  const pending = deferred<any>();
  const navigation: string[] = [];
  let signal: AbortSignal | undefined;
  fresh(async (_path, options) => {
    signal = options.signal;
    return pending.promise;
  });
  Object.assign(globalThis, {
    useDialogStore: () => ({ current: { dialog_id: 'D-one' } }),
    useMessagesStore: () => ({ loadAroundMessage: async (id: string) => navigation.push(id) }),
  });
  const search = useMessagesSearchStore();
  const request = search.fetchData('query');
  search.invalidate();
  pending.resolve({ data: [{ id: 'old' }] });
  await request;
  assert.equal(signal?.aborted, true);
  assert.deepEqual(search.list, []);
  assert.deepEqual(navigation, []);
  Object.assign(globalThis, { $http: async () => ({ data: [{ id: 'first' }, { id: 'last' }] }) });
  await search.fetchData('query');
  assert.deepEqual(navigation, ['last']);
  assert.equal(search.hasPrev, true);
  await search.selectIndex(0);
  assert.equal(search.hasNext, true);
});
