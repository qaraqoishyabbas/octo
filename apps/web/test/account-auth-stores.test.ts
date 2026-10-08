import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createPinia, setActivePinia } from 'pinia';
import { compileScript, compileTemplate, parse } from '@vue/compiler-sfc';
import { transpileModule, ModuleKind, ScriptTarget } from 'typescript';
import { computed, reactive, ref } from 'vue';
import type { User } from '../app/types/models.ts';

type ResponseData = {
  ok?: boolean;
  user?: User;
  token?: string;
  errors?: { name: string; message: string }[];
};
type HttpOptions = {
  method?: string;
  body?: unknown;
  onFetchResponse?: (context: { response: { status: number; _data: ResponseData } }) => void;
};
const cookies = new Map<string, ReturnType<typeof ref>>();
const calls: { path: string; options?: HttpOptions }[] = [];
const toasts: { title: string }[] = [];
const redirects: string[] = [];
const clearedUsers: string[] = [];
let resetCount = 0;
let respond: (path: string) => Promise<{ status: number; data: ResponseData }>;
Object.assign(globalThis, {
  ref,
  computed,
  useRuntimeConfig: () => ({ public: { apiBase: 'https://example.test' } }),
  useCookie: (name: string) => {
    if (!cookies.has(name)) cookies.set(name, ref(null));
    return cookies.get(name);
  },
  useToast: () => ({ add: (toast: { title: string }) => toasts.push(toast) }),
  navigateTo: async (path: string) => {
    redirects.push(path);
  },
  useMessagesDraftStore: () => ({ clearUser: (id: string) => clearedUsers.push(id) }),
  useUsersOnlineStore: () => ({ $reset: () => resetCount++ }),
  useDialogTypingStore: () => ({ $reset: () => resetCount++ }),
  useWebSocketStore: () => ({ $reset: () => resetCount++ }),
  $http: async (path: string, options?: HttpOptions) => {
    calls.push({ path, options });
    const response = await respond(path);
    options?.onFetchResponse?.({ response: { status: response.status, _data: response.data } });
    if (response.status === 401) useAuthStore().reset();
    if (response.status >= 400) throw new Error(`HTTP ${response.status}`);
    return response.data;
  },
});

const { useAuthStore } = await import('../app/stores/auth.ts');
const { useAccountStore } = await import('../app/stores/account.ts');
Object.assign(globalThis, { useAuthStore, useAccountStore });
const resetFeatureNames: string[] = [];
const featureStoreNames = [
  'useDevicesStore',
  'useChannelsStore',
  'useInvitationsStore',
  'useInviteLinksStore',
  'useProfileDetailsStore',
  'useProfileContentStore',
  'useProfileMembersStore',
  'useUploadsStore',
  'useFileDownloadsStore',
  'useMessagesSearchStore',
  'useDialogsSearchStore',
  'useDialogMembersStore',
  'useUsersStore',
  'useDialogsStore',
  'useDialogStore',
  'useMessagesStore',
];
Object.assign(
  globalThis,
  Object.fromEntries(
    featureStoreNames.map((name) => [name, () => ({ $reset: () => resetFeatureNames.push(name) })]),
  ),
);

const user: User = {
  id: 'user-1',
  dialog_id: 'dialog-1',
  first_name: 'First',
  last_name: 'Last',
  name: 'First Last',
  bio: null,
  email: 'user@example.test',
  username: 'username',
  birth_date: null,
  avatar: null,
  created_at: '',
  updated_at: '',
};
const credentials = { username: 'username', password: 'password', remember: true };
function freshStores() {
  setActivePinia(createPinia());
  cookies.clear();
  calls.length = 0;
  toasts.length = 0;
  redirects.length = 0;
  clearedUsers.length = 0;
  resetCount = 0;
  resetFeatureNames.length = 0;
  respond = async (path) => ({
    status: 200,
    data: path === 'me' ? { ok: true, user } : { ok: true, token: 'token-1' },
  });
  return { auth: useAuthStore(), account: useAccountStore() };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test('keeps token login compatible and loads the current user', async () => {
  const { auth } = freshStores();
  assert.equal(await auth.login('external-token'), undefined);
  assert.equal(auth.token, 'external-token');
  assert.equal(auth.logged, '1');
  assert.deepEqual(auth.user, user);
  assert.deepEqual(auth.current, user);
  assert.deepEqual(
    calls.map(({ path }) => path),
    ['me'],
  );
  await auth.login();
  assert.equal(auth.token, null);
});

test('authenticates credentials and stays pending through the user refresh', async () => {
  const { auth } = freshStores();
  const pending = deferred<{ status: number; data: ResponseData }>();
  respond = async (path) =>
    path === 'me' ? pending.promise : { status: 200, data: { ok: true, token: 'token-1' } };
  const request = auth.authenticate(credentials);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(auth.loginStatus, 'pending');
  assert.equal(auth.loading, true);
  pending.resolve({ status: 200, data: { ok: true, user } });
  assert.equal(await request, true);
  assert.deepEqual(calls[0], {
    path: 'login',
    options: {
      method: 'POST',
      body: credentials,
      onFetchResponse: calls[0]?.options?.onFetchResponse,
    },
  });
  assert.equal(auth.loginStatus, 'success');
  assert.equal(auth.loading, false);
  assert.deepEqual(redirects, []);
});

test('keeps login validation errors without duplicate toasts or authenticating', async () => {
  const { auth } = freshStores();
  const errors = [{ name: 'username', message: 'Invalid credentials' }];
  respond = async () => ({ status: 422, data: { errors } });
  assert.equal(await auth.authenticate(credentials), false);
  assert.deepEqual(auth.formErrors, errors);
  assert.equal(auth.loginStatus, 'error');
  assert.equal(auth.error, true);
  assert.equal(auth.logged, null);
  assert.deepEqual(toasts, []);
  assert.equal(calls.length, 1);
});

test(
  'ignores duplicate authentication while credentials or the user refresh are pending',
  { timeout: 1000 },
  async () => {
    const { auth } = freshStores();
    const pending = deferred<{ status: number; data: ResponseData }>();
    const pendingUser = deferred<{ status: number; data: ResponseData }>();
    respond = async (path) => (path === 'me' ? pendingUser.promise : pending.promise);
    const request = auth.authenticate(credentials);
    assert.equal(await auth.authenticate(credentials), false);
    assert.equal(calls.length, 1);
    pending.resolve({ status: 200, data: { ok: true, token: 'token-1' } });
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(await auth.authenticate(credentials), false);
    assert.deepEqual(
      calls.map(({ path }) => path),
      ['login', 'me'],
    );
    pendingUser.resolve({ status: 200, data: { ok: true, user } });
    assert.equal(await request, true);
  },
);

test('does not authenticate successfully when the user refresh fails', async () => {
  const { auth } = freshStores();
  respond = async (path) => {
    if (path === 'me') throw new Error('Unable to load user');
    return { status: 200, data: { ok: true, token: 'token-1' } };
  };
  assert.equal(await auth.authenticate(credentials), false);
  assert.equal(auth.loginStatus, 'error');
  assert.equal(auth.userStatus, 'error');
  assert.equal(auth.error, true);
  assert.equal(auth.loading, false);
});

test('ignores duplicate logout while pending', { timeout: 1000 }, async () => {
  const { auth } = freshStores();
  const pending = deferred<{ status: number; data: ResponseData }>();
  respond = async () => pending.promise;
  const request = auth.logout();
  await auth.logout();
  assert.equal(calls.length, 1);
  pending.resolve({ status: 200, data: { ok: true } });
  await request;
  assert.deepEqual(redirects, ['/']);
});

test(
  'ignores duplicate account actions while allowing independent fields',
  { timeout: 1000 },
  async () => {
    const { account } = freshStores();
    const pending = deferred<{ status: number; data: ResponseData }>();
    respond = async (path) =>
      path === 'account/username' ? pending.promise : { status: 200, data: { ok: true, user } };
    const request = account.updateUsername('newname');
    assert.equal(await account.updateUsername('duplicate'), false);
    assert.equal(await account.updateBirthDate(null), true);
    assert.equal(calls.filter(({ path }) => path === 'account/username').length, 1);
    pending.resolve({ status: 200, data: { ok: true } });
    assert.equal(await request, true);
  },
);

test('a new token login invalidates pending requests and resets feature data', async () => {
  const { auth, account } = freshStores();
  const pending = deferred<{ status: number; data: ResponseData }>();
  respond = async (path) =>
    path === 'account/username' ? pending.promise : { status: 200, data: { ok: true, user } };
  const request = account.updateUsername('newname');
  await auth.login('new-session-token');
  pending.resolve({ status: 200, data: { ok: true } });
  assert.equal(await request, false);
  assert.equal(account.status.username, 'idle');
  assert.deepEqual(toasts, []);
  assert.deepEqual(
    calls.map(({ path }) => path),
    ['account/username', 'me'],
  );
  assert.equal(resetCount, 3);
  assert.deepEqual(resetFeatureNames, featureStoreNames);
});

test('only replaces the user on HTTP 200 and resets on HTTP 401', async () => {
  const { auth, account } = freshStores();
  auth.user = user;
  respond = async () => ({ status: 204, data: {} });
  await auth.fetchUser();
  assert.deepEqual(auth.user, user);
  respond = async () => ({ status: 401, data: {} });
  assert.equal(await account.updateUsername('newname'), false);
  assert.deepEqual(auth.user, {});
  assert.equal(auth.logged, null);
  assert.equal(account.status.username, 'idle');
  assert.equal(account.loading, false);
});

test('keeps profile and birth date validation errors in their own state', async () => {
  const { account } = freshStores();
  const profileErrors = [{ name: 'first_name', message: 'Required' }];
  respond = async () => ({ status: 422, data: { errors: profileErrors } });
  assert.equal(await account.updateProfile(user), false);
  assert.deepEqual(account.formErrors.profile, profileErrors);
  const birthDateErrors = [{ name: 'birth_date', message: 'Invalid date' }];
  respond = async () => ({ status: 422, data: { errors: birthDateErrors } });
  assert.equal(await account.updateBirthDate('invalid'), false);
  assert.deepEqual(account.formErrors.birthDate, birthDateErrors);
  assert.deepEqual(account.formErrors.profile, profileErrors);
  assert.deepEqual(toasts, []);
});

test('updates each account field, refreshes the user, and emits the existing success toast', async () => {
  const { auth, account } = freshStores();
  auth.user = user;
  assert.equal(await account.updateProfile(user), true);
  assert.equal(await account.updateUsername('newname'), true);
  assert.equal(await account.updateBirthDate('2000-01-02'), true);
  assert.equal(await account.updateBirthDate(null), true);
  assert.deepEqual(
    calls.map(({ path }) => path),
    [
      'account/update',
      'me',
      'account/username',
      'me',
      'account/birth-date',
      'me',
      'account/birth-date',
      'me',
    ],
  );
  assert.deepEqual(calls[2]?.options?.body, { username: 'newname' });
  assert.deepEqual(calls[6]?.options?.body, { birth_date: null });
  assert.deepEqual(
    toasts.map(({ title }) => title),
    [
      'Данные аккаунта были успешно обновлены',
      'Имя пользователя обновлено',
      'Дата рождения обновлена',
      'Дата рождения удалена',
    ],
  );
  assert.deepEqual(account.current, auth.user);
  assert.equal(account.loading, false);
});

test('keeps account request statuses independent through refresh and validation failure', async () => {
  const { account } = freshStores();
  const pending = deferred<{ status: number; data: ResponseData }>();
  respond = async (path) => (path === 'me' ? pending.promise : { status: 200, data: { ok: true } });
  const request = account.updateProfile(user);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(account.status.profile, 'pending');
  assert.equal(account.status.username, 'idle');
  const errors = [{ name: 'username', message: 'Already taken' }];
  respond = async () => ({ status: 422, data: { errors } });
  assert.equal(await account.updateUsername('taken'), false);
  assert.deepEqual(account.formErrors.username, errors);
  assert.equal(account.status.username, 'error');
  assert.equal(account.status.profile, 'pending');
  pending.resolve({ status: 200, data: { ok: true, user } });
  assert.equal(await request, true);
  assert.equal(account.status.profile, 'success');
});

test('handles transport failures and unsuccessful payloads without success effects', async () => {
  const { auth, account } = freshStores();
  respond = async () => {
    throw new Error('offline');
  };
  await auth.fetchUser();
  assert.equal(auth.userStatus, 'error');
  assert.equal(await account.updateBirthDate(null), false);
  assert.equal(account.status.birthDate, 'error');
  respond = async () => ({ status: 200, data: { ok: false } });
  assert.equal(await auth.authenticate(credentials), false);
  assert.equal(await account.updateUsername('username'), false);
  assert.deepEqual(toasts, []);
  assert.deepEqual(redirects, []);
});

test('resets auth and owned account state and ignores late user responses', async () => {
  const { auth, account } = freshStores();
  auth.user = user;
  auth.token = 'token';
  auth.logged = '1';
  account.formErrors.username = [{ name: 'username', message: 'Taken' }];
  const pending = deferred<{ status: number; data: ResponseData }>();
  respond = async () => pending.promise;
  const request = auth.fetchUser();
  auth.$reset();
  pending.resolve({ status: 200, data: { ok: true, user } });
  await request;
  assert.deepEqual(auth.user, {});
  assert.equal(auth.token, null);
  assert.equal(auth.logged, null);
  assert.equal(auth.userStatus, 'idle');
  assert.equal(auth.loading, false);
  assert.deepEqual(account.formErrors, { profile: [], username: [], birthDate: [] });
  assert.deepEqual(account.status, { profile: 'idle', username: 'idle', birthDate: 'idle' });
  assert.deepEqual(clearedUsers, ['user-1']);
  assert.equal(resetCount, 3);
  assert.deepEqual(resetFeatureNames, featureStoreNames);
});

test('ignores late account mutations after auth reset', async () => {
  const { auth, account } = freshStores();
  const pending = deferred<{ status: number; data: ResponseData }>();
  respond = async () => pending.promise;
  const request = account.updateUsername('newname');
  auth.reset();
  pending.resolve({ status: 200, data: { ok: true } });
  assert.equal(await request, false);
  assert.equal(account.status.username, 'idle');
  assert.deepEqual(toasts, []);
  assert.deepEqual(
    calls.map(({ path }) => path),
    ['account/username'],
  );
});

test('logout resets on HTTP 200 and preserves its existing redirect', async () => {
  const { auth } = freshStores();
  auth.user = user;
  await auth.logout();
  assert.deepEqual(auth.user, {});
  assert.deepEqual(redirects, ['/']);
  respond = async () => ({ status: 500, data: {} });
  auth.user = user;
  await auth.logout();
  assert.deepEqual(auth.user, user);
  assert.deepEqual(redirects, ['/']);
  assert.equal(auth.logoutStatus, 'error');
});

test('account and login views delegate network operations to stores', async () => {
  for (const path of [
    'components/feature/account/Account.vue',
    'components/feature/account/AccountUsername.vue',
    'components/feature/account/AccountBirthDate.vue',
    'pages/login.vue',
    'components/feature/login/LoginForm.vue',
    'stores/auth.ts',
    'stores/account.ts',
  ]) {
    const source = await readFile(new URL(`../app/${path}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /\buse(?:Http|Fetch|LazyHttp|LazyFetch)\s*[<(]/, path);
    if (path.endsWith('.vue')) assert.doesNotMatch(source, /\$http\s*[<(]/, path);
  }
});

async function evaluateSetup(path: string, bindings: Record<string, unknown>, returned: string) {
  const filename = new URL(`../app/${path}`, import.meta.url);
  const source = await readFile(filename, 'utf8');
  const { descriptor } = parse(source, { filename: filename.pathname });
  assert.ok(descriptor.scriptSetup);
  const { outputText } = transpileModule(descriptor.scriptSetup.content, {
    compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 },
  });
  return new Function('exports', ...Object.keys(bindings), `${outputText}\nreturn ${returned};`)(
    {},
    ...Object.values(bindings),
  );
}

test('login form applies field errors and emits success only after authentication', async () => {
  const { auth } = freshStores();
  const events: string[] = [];
  const props = reactive({ redirecting: false });
  let displayedErrors: unknown;
  const setup = await evaluateSetup(
    'components/feature/login/LoginForm.vue',
    {
      useAuthStore,
      ref,
      reactive,
      computed,
      defineEmits: () => (event: string) => events.push(event),
      defineProps: () => props,
      useTemplateRef: () =>
        ref({
          setErrors: (errors: unknown) => {
            displayedErrors = errors;
          },
        }),
    },
    '{ onSubmit, state, loading }',
  );
  Object.assign(setup.state, credentials);
  const errors = [{ name: 'username', message: 'Invalid credentials' }];
  respond = async () => ({ status: 422, data: { errors } });
  await setup.onSubmit();
  assert.deepEqual(displayedErrors, errors);
  assert.deepEqual(events, []);
  assert.equal(setup.loading.value, false);
  respond = async (path) => ({
    status: 200,
    data: path === 'me' ? { ok: true, user } : { ok: true, token: 'new-token' },
  });
  await setup.onSubmit();
  assert.deepEqual(events, ['success']);
  assert.equal(auth.token, 'new-token');
  assert.deepEqual(auth.user, user);
  props.redirecting = true;
  assert.equal(setup.loading.value, true);
  props.redirecting = false;
  assert.equal(setup.loading.value, false);
});

test('login page validates redirects and preserves mount/unmount message handling', async () => {
  freshStores();
  const query = reactive<{ redirect: unknown }>({ redirect: '/calls/room/friend' });
  const lifecycle: { mount?: () => void; unmount?: () => void } = {};
  const listeners: { action: string; name: string; handler: unknown }[] = [];
  const setup = await evaluateSetup(
    'pages/login.vue',
    {
      definePageMeta: () => {},
      useSeoMeta: () => {},
      computed,
      ref,
      useRouter: () => ({
        push: async (path: string) => {
          redirects.push(path);
        },
      }),
      useRoute: () => ({ query }),
      useToast: () => ({ add: (toast: { title: string }) => toasts.push(toast) }),
      onMounted: (callback: () => void) => {
        lifecycle.mount = callback;
      },
      onBeforeUnmount: (callback: () => void) => {
        lifecycle.unmount = callback;
      },
      window: {
        addEventListener: (name: string, handler: unknown) =>
          listeners.push({ action: 'add', name, handler }),
        removeEventListener: (name: string, handler: unknown) =>
          listeners.push({ action: 'remove', name, handler }),
      },
    },
    '{ redirectPath, handleSuccess, handleMessage }',
  );
  await setup.handleSuccess();
  assert.deepEqual(redirects, ['/calls/room/friend']);
  for (const redirect of [
    '//example.test',
    '/login',
    'https://example.test',
    ['/', '/other'],
    undefined,
  ]) {
    query.redirect = redirect;
    assert.equal(setup.redirectPath.value, '/');
  }
  lifecycle.mount?.();
  lifecycle.unmount?.();
  assert.deepEqual(
    listeners.map(({ action, name }) => ({ action, name })),
    [
      { action: 'add', name: 'message' },
      { action: 'remove', name: 'message' },
    ],
  );
  assert.equal(listeners[0]?.handler, listeners[1]?.handler);
  setup.handleMessage({ data: null });
  setup.handleMessage({ data: { message: 'Login failed' } });
  assert.deepEqual(
    toasts.map(({ title }) => title),
    ['Login failed'],
  );
});

test('changed Vue views compile and preserve form fields', async () => {
  for (const path of [
    'components/feature/account/Account.vue',
    'components/feature/account/AccountUsername.vue',
    'components/feature/account/AccountBirthDate.vue',
    'components/feature/login/LoginForm.vue',
    'pages/login.vue',
  ]) {
    const filename = new URL(`../app/${path}`, import.meta.url);
    const source = await readFile(filename, 'utf8');
    const { descriptor, errors } = parse(source, { filename: filename.pathname });
    assert.deepEqual(errors, [], path);
    const script = compileScript(descriptor, { id: path });
    assert.ok(descriptor.template);
    const template = compileTemplate({
      source: descriptor.template.content,
      filename: filename.pathname,
      id: path,
      compilerOptions: { bindingMetadata: script.bindings },
    });
    assert.deepEqual(template.errors, [], path);
    if (path.endsWith('LoginForm.vue')) {
      assert.match(descriptor.template.content, /name="username"/);
      assert.match(descriptor.template.content, /name="password"/);
      assert.match(descriptor.template.content, /v-model="state.remember"/);
    }
  }
});
