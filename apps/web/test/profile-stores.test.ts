import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { createPinia, setActivePinia } from 'pinia';
import { compileScript, compileTemplate, parse } from '@vue/compiler-sfc';
import { useProfileContentStore } from '../app/stores/profile-content.ts';
import { useProfileDetailsStore } from '../app/stores/profile-details.ts';
import { useProfileMembersStore } from '../app/stores/profile-members.ts';
import { useInviteLinksStore } from '../app/stores/invite-links.ts';

const deferred = () => {
  let resolve!: (value: any) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<any>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const user = (id: string, role = 'member') => ({ id, name: id, dialog_role: role });
const membersResponse = (users: any[], has_more = false) => ({
  users,
  has_more,
  total: users.length,
});
const setup = (http: (...args: any[]) => any) => {
  setActivePinia(createPinia());
  const current = { dialog_id: 'team', username: 'team', users_count: 1 };
  const messages: any[] = [];
  const details: any[] = [];
  Object.assign(globalThis, {
    $http: http,
    useUsersOnlineStore: () => ({ setBackendLastSeen: () => {} }),
    useDialogStore: () => ({ current }),
    useDialogsStore: () => ({ updateDialogDetails: (value: any) => details.push(value) }),
    useMessagesStore: () => ({
      appendMessage: async (value: any) => {
        messages.push(value);
      },
    }),
  });
  return { current, messages, details };
};

test('content scopes isolate kinds and targets, encode targets, and deduplicate pages', async () => {
  const calls: any[] = [];
  setup(async (url, options) => {
    calls.push([url, options]);
    return url.endsWith('/links')
      ? { links: [{ id: 'link' }], has_more: false }
      : {
          attachments: [
            { id: 'one', dialog_id: 'shared' },
            { id: 'one', dialog_id: 'shared' },
            { id: `page-${options.query.page}`, dialog_id: 'shared' },
          ],
          has_more: options.query.page === 1,
        };
  });
  const store = useProfileContentStore();
  const media = store.createScope('media');
  const links = store.createScope('links');
  const other = store.createScope('media');
  await Promise.all([media.fetchData('a/b'), links.fetchData('a/b'), other.fetchData('other')]);
  await media.fetchData('a/b');
  assert.deepEqual(
    media.state.list.map((item) => item.id),
    ['one', 'page-1', 'page-2'],
  );
  assert.deepEqual(
    links.state.list.map((item) => item.id),
    ['link'],
  );
  assert.equal(other.state.page, 2);
  assert.equal(calls[0][0], 'dialogs/a%2Fb/attachments');
  assert.equal(calls[0][1].query.type, 'media');
  const count = calls.length;
  await media.fetchData('a/b');
  assert.equal(calls.length, count);
});

test('reset and force refresh prevent old content responses and finalizers from touching new data', async () => {
  const old = deferred();
  const fresh = deferred();
  let call = 0;
  setup(() => (++call === 1 ? old.promise : fresh.promise));
  const scope = useProfileContentStore().createScope('files');
  const first = scope.fetchData('old');
  const second = scope.fetchData('new', { force: true });
  old.reject(new Error('Old request failed'));
  await first;
  assert.equal(scope.state.loading, true);
  assert.equal(scope.state.error, false);
  fresh.resolve({ attachments: [{ id: 'new' }], has_more: false });
  await second;
  assert.equal(scope.state.list[0]?.id, 'new');
  assert.equal(scope.state.loading, false);
  scope.dispose();
  assert.deepEqual(useProfileContentStore().scopes, {});
});

test('a failed content page can retry without skipping its page', async () => {
  const pages: number[] = [];
  setup(async (_url, options) => {
    pages.push(options.query.page);
    if (pages.length === 1) throw new Error('offline');
    return { links: [{ id: 'link' }], has_more: false };
  });
  const scope = useProfileContentStore().createScope('links');
  await scope.fetchData('team');
  assert.equal(scope.state.error, true);
  await scope.fetchData('team');
  assert.deepEqual(pages, [1, 1]);
  assert.equal(scope.state.error, false);
});

test('member all-pages loading commits a deduplicated snapshot and stops after reset', async () => {
  const pending = deferred();
  let calls = 0;
  setup(async () => (++calls === 1 ? membersResponse([user('one')], true) : pending.promise));
  const scope = useProfileMembersStore().createScope();
  const request = scope.fetchData('team', { all: true });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 2);
  assert.deepEqual(scope.state.list, []);
  scope.$reset();
  pending.resolve(membersResponse([user('two')], true));
  await request;
  assert.equal(calls, 2);
  assert.deepEqual(scope.state.list, []);
  assert.equal(scope.state.loading, false);
  setup(async (_url, options) =>
    membersResponse([user('one'), user(String(options.query.page))], options.query.page === 1),
  );
  const fresh = useProfileMembersStore().createScope();
  await fresh.fetchData('team', { all: true });
  assert.deepEqual(
    fresh.state.list.map((item) => item.id),
    ['one', '1', '2'],
  );
});

test('member filters isolate lists; demotion synchronizes scopes and invalidates pending pages', async () => {
  const pending = deferred();
  let calls = 0;
  setup(async (url) => {
    if (url.endsWith('/role')) return { ok: true, role: 'member', permissions: [] };
    return ++calls <= 2 ? membersResponse([user('one', 'admin')], true) : pending.promise;
  });
  const store = useProfileMembersStore();
  const audience = store.createScope();
  const admins = store.createScope();
  await audience.fetchData('team');
  await admins.fetchData('team', { roles: 'owner,admin' });
  const oldPage = admins.fetchData('team', { roles: 'owner,admin' });
  await audience.updateRole('team', audience.state.list[0]!, 'member');
  assert.equal(audience.state.list[0]?.dialog_role, 'member');
  assert.deepEqual(admins.state.list, []);
  assert.equal(audience.state.busyUserAction, null);
  pending.resolve(membersResponse([user('one', 'admin')]));
  await oldPage;
  assert.deepEqual(admins.state.list, []);
});

test('removal invalidates pending member pages and updates current counts and messages', async () => {
  const pending = deferred();
  let reads = 0;
  const { current, messages } = setup(async (_url, options) => {
    if (options?.method === 'DELETE')
      return { removed: true, users_count: 0, message: { id: 'removed' } };
    return ++reads === 1 ? membersResponse([user('one')], true) : pending.promise;
  });
  const scope = useProfileMembersStore().createScope();
  await scope.fetchData('team');
  const oldPage = scope.fetchData('team');
  await scope.remove('team', scope.state.list[0]!);
  assert.equal(current.users_count, 0);
  assert.equal(messages[0].id, 'removed');
  assert.equal(scope.state.busyUserAction, null);
  pending.resolve(membersResponse([user('one')]));
  await oldPage;
  assert.deepEqual(scope.state.list, []);
});

test('member soft refresh replaces the loaded snapshot and resumes pagination at page two', async () => {
  const pages: number[] = [];
  setup(async (_url, options) => {
    pages.push(options.query.page);
    return membersResponse([user(String(pages.length))], true);
  });
  const scope = useProfileMembersStore().createScope();
  await scope.fetchData('team');
  await scope.fetchData('team');
  await scope.fetchData('team', { soft: true });
  assert.deepEqual(pages, [1, 2, 1]);
  assert.deepEqual(
    scope.state.list.map((item) => item.id),
    ['3'],
  );
  assert.equal(scope.state.page, 2);
  assert.equal(scope.state.softRefreshing, false);
});

test('profile fetch ignores an earlier target and save synchronizes dialog details', async () => {
  const old = deferred();
  const { details } = setup(async (url, options) => {
    if (options?.method === 'PATCH')
      return { ok: true, dialog: { dialog_id: 'team', title: 'Updated' } };
    return url.endsWith('/old') ? old.promise : { dialog: { dialog_id: 'team' } };
  });
  const scope = useProfileDetailsStore().createScope();
  const request = scope.fetchData('old');
  await scope.fetchData('team');
  old.resolve({ dialog: { dialog_id: 'old' } });
  await request;
  assert.equal(scope.state.profile?.dialog_id, 'team');
  await scope.save('team', { title: 'Updated', description: null, avatar: null });
  assert.equal(details[0].title, 'Updated');
  assert.equal(scope.state.saving, false);
});

test('invite generation resets stale tokens, ignores stale completions, and rejects empty tokens', async () => {
  const old = deferred();
  setup(async (url) => (url.includes('/old/') ? old.promise : { ok: true, token: 'new' }));
  const scope = useInviteLinksStore().createScope();
  const request = scope.fetchData('old');
  await scope.fetchData('new');
  old.resolve({ ok: true, token: 'old' });
  assert.equal(await request, undefined);
  assert.equal(scope.state.token, 'new');
  Object.assign(globalThis, { $http: async () => ({ ok: true, token: ' ' }) });
  await assert.rejects(scope.fetchData('empty'), /Invite token/);
  assert.equal(scope.state.token, '');
  assert.equal(scope.state.error, true);
  assert.equal(scope.state.loading, false);
});

test('group scopes cache even an empty result and support explicit retry/refresh', async () => {
  let calls = 0;
  setup(async () => {
    calls++;
    return { groups: [] };
  });
  const scope = useProfileContentStore().createScope('groups');
  await scope.fetchData('team');
  await scope.fetchData('team');
  assert.equal(calls, 1);
  await scope.fetchData('team', { force: true });
  assert.equal(calls, 2);
});

test('failed membership mutations leave fetch errors independent and can be retried', async () => {
  let calls = 0;
  setup(async () => {
    if (++calls === 1) throw new Error('offline');
    return { ok: true, added: 1, users_count: 2 };
  });
  const scope = useProfileMembersStore().createScope();
  await assert.rejects(scope.add('team', ['one']), /offline/);
  assert.equal(scope.state.error, false);
  assert.equal(scope.state.mutationError, true);
  assert.equal(scope.state.saving, false);
  assert.equal((await scope.add('team', ['one']))?.added, 1);
  assert.equal(scope.state.mutationError, false);
});

test('role updates preserve the distinction between default and explicit admin permissions', async () => {
  const bodies: any[] = [];
  setup(async (_url, options) => {
    bodies.push(options.body);
    return { ok: true, role: options.body.role, permissions: options.body.permissions ?? [] };
  });
  const scope = useProfileMembersStore().createScope();
  await scope.updateRole('team', user('one') as any, 'admin');
  await scope.updateRole('team', user('one') as any, 'admin', ['invite_users']);
  await scope.updateRole('team', user('one') as any, 'member', []);
  assert.deepEqual(bodies, [
    { role: 'admin' },
    { role: 'admin', permissions: ['invite_users'] },
    { role: 'member', permissions: [] },
  ]);
});

test('store resets invalidate pending mutations, including stale failures', async () => {
  const pending = deferred();
  setup(() => pending.promise);
  const store = useProfileMembersStore();
  const scope = store.createScope();
  const request = scope.add('old', ['one']);
  store.$reset();
  pending.reject(new Error('stale failure'));
  assert.equal(await request, undefined);
  assert.equal(scope.state.mutationError, false);
  assert.equal(scope.state.saving, false);

  const invitePending = deferred();
  Object.assign(globalThis, { $http: () => invitePending.promise });
  const invites = useInviteLinksStore();
  const inviteScope = invites.createScope();
  const inviteRequest = inviteScope.fetchData('old');
  invites.$reset();
  invitePending.reject(new Error('stale invite failure'));
  assert.equal(await inviteRequest, undefined);
  assert.equal(inviteScope.state.error, false);
});

test('saving profile details invalidates a pending fetch and reset suppresses a stale save', async () => {
  const pending = deferred();
  setup(async (_url, options) =>
    options?.method === 'PATCH'
      ? { ok: true, dialog: { dialog_id: 'team', title: 'Saved' } }
      : pending.promise,
  );
  const store = useProfileDetailsStore();
  const scope = store.createScope();
  const request = scope.fetchData('team');
  await scope.save('team', { title: 'Saved', description: null, avatar: null });
  pending.resolve({ dialog: { dialog_id: 'team', title: 'Old' } });
  await request;
  assert.equal(scope.state.profile?.title, 'Saved');
  const savePending = deferred();
  Object.assign(globalThis, { $http: () => savePending.promise });
  const saveRequest = scope.save('team', { title: 'Next', description: null, avatar: null });
  store.$reset();
  savePending.reject(new Error('stale save'));
  assert.equal(await saveRequest, undefined);
  assert.equal(scope.state.profile, null);
  assert.equal(scope.state.error, false);
});

test('owned profile components compile and contain no direct request transport', async () => {
  const directory = new URL('../app/components/feature/profile/', import.meta.url);
  for (const name of (await readdir(directory)).filter((name) => name.endsWith('.vue'))) {
    const source = await readFile(new URL(name, directory), 'utf8');
    assert.doesNotMatch(source, /\$http|useHttp|XMLHttpRequest/);
    const { descriptor, errors } = parse(source, { filename: name });
    assert.deepEqual(errors, [], name);
    if (descriptor.scriptSetup) compileScript(descriptor, { id: name });
    assert.deepEqual(
      compileTemplate({ source: descriptor.template!.content, filename: name, id: name }).errors,
      [],
      name,
    );
  }
  const clipboard = await readFile(
    new URL('../app/composables/useInviteLinkClipboard.ts', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(clipboard, /\$http|useHttp|XMLHttpRequest/);
  for (const name of [
    'ProfileMedia',
    'ProfileFiles',
    'ProfileLinks',
    'ProfileGroups',
    'ProfileUsers',
  ]) {
    const source = await readFile(new URL(`${name}.vue`, directory), 'utf8');
    for (const component of ['ProfileListLoading', 'ProfileListError', 'ProfileListEmpty'])
      assert.ok(source.includes(`<${component}`), `${name} composes ${component}`);
  }
});
