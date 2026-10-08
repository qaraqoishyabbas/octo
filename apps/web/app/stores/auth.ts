import { defineStore } from 'pinia';
import type { FormError } from '#ui/types';
import type { User } from '~/types';

export type AuthRequestStatus = 'idle' | 'pending' | 'success' | 'error';
export type LoginCredentials = { username: string; password: string; remember: boolean };
type UserResponse = { ok: boolean; user: User };
type LoginResponse = { ok: boolean; token?: string | null; errors?: FormError[] };
type LogoutResponse = { ok: boolean };

export const useAuthStore = defineStore('auth', () => {
  const config = useRuntimeConfig();

  const loggedCookie = useCookie('logged', {
    path: '/',
    sameSite: 'strict',
    secure: config.public.apiBase.startsWith('https://'),
    maxAge: 60 * 60 * 24 * 365,
  });
  const tokenCookie = useCookie<string | null>('auth_token', {
    path: '/',
    sameSite: 'strict',
    secure: config.public.apiBase.startsWith('https://'),
    maxAge: 60 * 60 * 24 * 365,
  });

  const user = ref<User>({} as User);
  const userStatus = ref<AuthRequestStatus>('idle');
  const loginStatus = ref<AuthRequestStatus>('idle');
  const logoutStatus = ref<AuthRequestStatus>('idle');
  const error = ref(false);
  const formErrors = ref<FormError[]>([]);
  const loading = computed(() =>
    [userStatus.value, loginStatus.value, logoutStatus.value].includes('pending'),
  );
  let generation = 0;

  async function fetchUser(): Promise<void> {
    const requestGeneration = generation;
    userStatus.value = 'pending';
    error.value = false;
    try {
      let succeeded = false;
      const data = await $http<UserResponse>('me', {
        onFetchResponse({ response }) {
          succeeded = response.status === 200;
        },
      });
      if (requestGeneration !== generation) return;
      if (succeeded) user.value = data.user;
      userStatus.value = 'success';
    } catch {
      if (requestGeneration !== generation) return;
      userStatus.value = 'error';
      error.value = true;
    }
  }

  async function authenticate(credentials: LoginCredentials): Promise<boolean> {
    if (loginStatus.value === 'pending') return false;
    let requestGeneration = generation;
    loginStatus.value = 'pending';
    formErrors.value = [];
    error.value = false;
    try {
      const data = await $http<LoginResponse>('login', {
        method: 'POST',
        body: { ...credentials },
        onFetchResponse({ response }) {
          if (requestGeneration !== generation || response.status !== 422) return;
          const payload = response._data as LoginResponse;
          formErrors.value = payload.errors ?? [];
        },
      });
      if (requestGeneration !== generation) return false;
      if (!data.ok) {
        loginStatus.value = 'error';
        error.value = true;
        return false;
      }
      const session = login(data.token);
      requestGeneration = generation;
      loginStatus.value = 'pending';
      await session;
      if (requestGeneration !== generation) return false;
      if (userStatus.value !== 'success') {
        loginStatus.value = 'error';
        error.value = true;
        return false;
      }
      loginStatus.value = 'success';
      return true;
    } catch {
      if (requestGeneration !== generation) return false;
      loginStatus.value = 'error';
      error.value = true;
      return false;
    }
  }

  async function logout(): Promise<void> {
    if (logoutStatus.value === 'pending') return;
    const requestGeneration = generation;
    logoutStatus.value = 'pending';
    error.value = false;
    try {
      if (import.meta.client) {
        const pushTokenId = localStorage.getItem('octo_push_token_id');
        if (pushTokenId) {
          try {
            await $http(`push-tokens/${pushTokenId}`, { method: 'DELETE' });
          } catch {
            // The auth token deletion below also removes its push registration.
          }
          localStorage.removeItem('octo_push_token_id');
        }
        try {
          const worker = await navigator.serviceWorker?.getRegistration('/push/');
          await (await worker?.pushManager.getSubscription())?.unsubscribe();
        } catch {
          // Logout proceeds even if the browser refuses to unsubscribe.
        }
      }
      let succeeded = false;
      await $http<LogoutResponse>('logout', {
        method: 'POST',
        onFetchResponse({ response }) {
          succeeded = response.status === 200;
        },
      });
      if (requestGeneration !== generation) return;
      if (succeeded) {
        reset();
        await navigateTo('/');
      } else {
        logoutStatus.value = 'success';
      }
    } catch {
      if (requestGeneration !== generation) return;
      logoutStatus.value = 'error';
      error.value = true;
    }
  }

  async function login(token?: string | null): Promise<void> {
    generation++;
    resetFeatureStores();
    user.value = {} as User;
    loginStatus.value = 'idle';
    logoutStatus.value = 'idle';
    tokenCookie.value = token ?? null;
    loggedCookie.value = '1';
    await fetchUser();
  }

  function resetFeatureStores() {
    useUsersOnlineStore().$reset();
    useDialogTypingStore().$reset();
    useWebSocketStore().$reset();
    useAccountStore().$reset();
    useDevicesStore().$reset();
    useChannelsStore().$reset();
    useInvitationsStore().$reset();
    useInviteLinksStore().$reset();
    useProfileDetailsStore().$reset();
    useProfileContentStore().$reset();
    useProfileMembersStore().$reset();
    useUploadsStore().$reset();
    useFileDownloadsStore().$reset();
    useMessagesSearchStore().$reset();
    useDialogsSearchStore().$reset();
    useDialogMembersStore().$reset();
    useUsersStore().$reset();
    useDialogsStore().$reset();
    useDialogStore().$reset();
    useMessagesStore().$reset();
  }

  function reset(): void {
    generation++;
    const currentUserId = user.value?.id;

    if (currentUserId) {
      useMessagesDraftStore().clearUser(currentUserId);
    }

    resetFeatureStores();

    loggedCookie.value = null;
    tokenCookie.value = null;
    user.value = {} as User;
    userStatus.value = 'idle';
    loginStatus.value = 'idle';
    logoutStatus.value = 'idle';
    error.value = false;
    formErrors.value = [];
  }

  return {
    user,
    current: user,
    loading,
    error,
    userStatus,
    loginStatus,
    logoutStatus,
    formErrors,
    token: tokenCookie,
    logged: loggedCookie,
    login,
    authenticate,
    logout,
    fetchUser,
    reset,
    $reset: reset,
  };
});
