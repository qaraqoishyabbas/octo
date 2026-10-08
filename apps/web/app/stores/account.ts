import { defineStore } from 'pinia';
import type { FormError } from '#ui/types';
import type { User } from '~/types';
import type { AuthRequestStatus } from './auth';

export type AccountProfile = Pick<
  User,
  'email' | 'name' | 'first_name' | 'last_name' | 'bio' | 'avatar'
>;
type AccountAction = 'profile' | 'username' | 'birthDate';
type AccountResponse = { ok: boolean; errors?: FormError[] };

export const useAccountStore = defineStore('account', () => {
  const auth = useAuthStore();
  const toast = useToast();
  const current = computed(() => auth.user);
  const status = ref<Record<AccountAction, AuthRequestStatus>>({
    profile: 'idle',
    username: 'idle',
    birthDate: 'idle',
  });
  const formErrors = ref<Record<AccountAction, FormError[]>>({
    profile: [],
    username: [],
    birthDate: [],
  });
  const loading = computed(() => Object.values(status.value).includes('pending'));
  const error = ref(false);
  let generation = 0;

  async function save(
    action: AccountAction,
    path: string,
    body: AccountProfile | { username: string } | { birth_date: string | null },
    title: string,
  ): Promise<boolean> {
    if (status.value[action] === 'pending') return false;
    const requestGeneration = generation;
    status.value[action] = 'pending';
    formErrors.value[action] = [];
    error.value = false;
    try {
      const data = await $http<AccountResponse>(path, {
        method: 'POST',
        body: { ...body },
        onFetchResponse({ response }) {
          if (requestGeneration !== generation || response.status !== 422) return;
          const payload = response._data as AccountResponse;
          formErrors.value[action] = payload.errors ?? [];
        },
      });
      if (requestGeneration !== generation) return false;
      if (!data.ok) {
        status.value[action] = 'error';
        error.value = true;
        return false;
      }
      toast.add({
        title,
        color: 'success',
        icon: 'i-ph-check-circle-fill',
        progress: false,
        duration: 2000,
        close: false,
      });
      await auth.fetchUser();
      if (requestGeneration !== generation) return false;
      status.value[action] = 'success';
      return true;
    } catch {
      if (requestGeneration !== generation) return false;
      status.value[action] = 'error';
      error.value = true;
      return false;
    }
  }

  function updateProfile(profile: AccountProfile) {
    return save('profile', 'account/update', profile, 'Данные аккаунта были успешно обновлены');
  }

  function updateUsername(username: string) {
    return save('username', 'account/username', { username }, 'Имя пользователя обновлено');
  }

  function updateBirthDate(birthDate: string | null) {
    return save(
      'birthDate',
      'account/birth-date',
      { birth_date: birthDate },
      birthDate ? 'Дата рождения обновлена' : 'Дата рождения удалена',
    );
  }

  function $reset() {
    generation++;
    status.value = { profile: 'idle', username: 'idle', birthDate: 'idle' };
    formErrors.value = { profile: [], username: [], birthDate: [] };
    error.value = false;
  }

  return {
    current,
    status,
    formErrors,
    loading,
    error,
    updateProfile,
    updateUsername,
    updateBirthDate,
    $reset,
  };
});
