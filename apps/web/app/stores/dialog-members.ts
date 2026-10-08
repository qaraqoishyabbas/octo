import { defineStore } from 'pinia';
import type { User } from '~/types';

type UsersResponse = {
  ok: boolean;
  users: User[];
  has_more: boolean;
  total: number;
};

export const useDialogMembersStore = defineStore('dialog-members', () => {
  const list = ref<User[]>([]);
  const loading = ref(false);
  const error = ref(false);
  const loadedTarget = ref<string | null>(null);
  const requestSequence = ref(0);

  const byId = computed(() => {
    const items = new Map<string, User>();

    list.value.forEach((user) => {
      const userId = String(user.id ?? '').trim();
      if (userId) {
        items.set(userId, user);
      }
    });

    return items;
  });

  const fetchAll = async (target: string) => {
    const normalizedTarget = String(target ?? '').trim();
    if (!normalizedTarget || loading.value || loadedTarget.value === normalizedTarget) {
      return;
    }

    const requestId = ++requestSequence.value;
    loading.value = true;
    error.value = false;
    list.value = [];

    try {
      const members: User[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore && requestId === requestSequence.value) {
        const data = await $http<UsersResponse>(
          `dialogs/${encodeURIComponent(normalizedTarget)}/users`,
          {
            query: {
              page,
              per_page: 100,
            },
          },
        );

        members.push(...(data?.users ?? []));
        hasMore = Boolean(data?.has_more);
        page += 1;
      }

      if (requestId !== requestSequence.value) {
        return;
      }

      list.value = members;
      loadedTarget.value = normalizedTarget;
    } catch {
      if (requestId !== requestSequence.value) {
        return;
      }

      error.value = true;
      loadedTarget.value = null;
    } finally {
      if (requestId === requestSequence.value) {
        loading.value = false;
      }
    }
  };

  function $reset() {
    requestSequence.value += 1;
    list.value = [];
    loading.value = false;
    error.value = false;
    loadedTarget.value = null;
  }

  return {
    list,
    loading,
    error,
    loadedTarget,
    byId,
    fetchAll,
    $reset,
  };
});
