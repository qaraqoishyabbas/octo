import { useDebounceFn } from '@vueuse/core';
import { defineStore } from 'pinia';
import type { Dialog, DialogType, User } from '~/types';

type UsersResponse = {
  ok: boolean;
  users: User[];
};

export type DialogsSearchContactResult = {
  key: string;
  target: string;
  title: string;
  description?: string | null;
  avatar?: string | null;
  type?: DialogType | null;
  is_online?: boolean;
};

export const useDialogsSearchStore = defineStore('dialogs-search', () => {
  const { withCount } = useInflection();
  const dialogs = useDialogsStore();
  const usersOnline = useUsersOnlineStore();

  const query = ref('');
  const users = ref<User[]>([]);
  const usersLoading = ref(false);
  const usersError = ref(false);
  const usersLoadedQuery = ref<string | null>(null);
  const randomSeed = ref(0);
  let activeController: AbortController | null = null;

  const normalizedQuery = computed(() => query.value.trim().toLowerCase());
  const isSearching = computed(() => normalizedQuery.value.length > 0);
  const usersLoadedCurrentQuery = computed(() => usersLoadedQuery.value === normalizedQuery.value);

  const usernameText = (username?: string | null) => (username ? `@${username}` : 'был(-а) давно');

  const formatDialogAudience = (dialog: Dialog) => {
    if (dialog.type === 'C') {
      return withCount(dialog.users_count, ['подписчик', 'подписчика', 'подписчиков']);
    }

    if (dialog.type === 'G') {
      return withCount(dialog.users_count, ['участник', 'участника', 'участников']);
    }

    if (dialog.type === 'D' && dialog.author_id) {
      return usersOnline.getOnlineText(dialog.author_id, usernameText(dialog.username));
    }

    return dialog.description || dialog.email || '';
  };

  const sortedBySeed = (items: Dialog[]) =>
    [...items].sort((a, b) => {
      const aKey = Math.sin((Number(a.id) || 1) * 10000 + randomSeed.value) % 1;
      const bKey = Math.sin((Number(b.id) || 1) * 10000 + randomSeed.value) % 1;

      return aKey - bKey;
    });

  const suggestedDialogs = computed(() => sortedBySeed(dialogs.list).slice(0, 8));

  const matchesDialog = (dialog: Dialog, search: string) =>
    String(dialog.title ?? '')
      .toLowerCase()
      .includes(search);

  const dialogResults = computed(() => {
    if (!isSearching.value) {
      return [];
    }

    return dialogs.list.filter((dialog) => matchesDialog(dialog, normalizedQuery.value));
  });

  const contactResults = computed<DialogsSearchContactResult[]>(() => {
    if (
      !isSearching.value ||
      usersLoading.value ||
      usersError.value ||
      !usersLoadedCurrentQuery.value
    ) {
      return [];
    }

    const userItems: DialogsSearchContactResult[] = users.value
      .filter((user) => user.username)
      .map((user) => ({
        key: `user-${user.id}`,
        target: user.username,
        title: user.name,
        description: usersOnline.getOnlineText(user.id, usernameText(user.username)),
        avatar: user.avatar,
        type: 'D',
        is_online: usersOnline.isOnline(user.id),
      }));

    const userTargets = new Set(userItems.map((item) => item.target));
    const dialogItems: DialogsSearchContactResult[] = dialogResults.value
      .filter((dialog) => !dialog.username || !userTargets.has(dialog.username))
      .slice(0, 8)
      .map((dialog) => ({
        key: `dialog-${dialog.dialog_id}`,
        target: dialog.username || dialog.dialog_id,
        title: dialog.title || 'Диалог',
        description: formatDialogAudience(dialog),
        avatar: dialog.avatar,
        type: dialog.type,
        is_online: dialog.type === 'D' && usersOnline.isOnline(dialog.author_id),
      }));

    return [...dialogItems, ...userItems].slice(0, 12);
  });

  const fetchUsers = async () => {
    activeController?.abort();
    usersError.value = false;

    if (!isSearching.value) {
      users.value = [];
      usersLoading.value = false;
      usersLoadedQuery.value = null;
      return;
    }

    const requestQuery = normalizedQuery.value;
    const controller = new AbortController();
    activeController = controller;
    usersLoading.value = true;

    try {
      const data = await $http<UsersResponse>('users', {
        query: {
          q: query.value,
          per_page: 20,
        },
        signal: controller.signal,
      });

      if (activeController !== controller) {
        return;
      }

      users.value = data.users ?? [];
      users.value.forEach((user) => {
        const lastSeenAt = user.last_seen_at;
        if (lastSeenAt !== undefined) {
          usersOnline.setBackendLastSeen(user.id, lastSeenAt);
        }
      });
      usersLoadedQuery.value = requestQuery;
    } catch (e) {
      if (activeController !== controller) return;
      if (e instanceof DOMException && e.name === 'AbortError') {
        return;
      }
      users.value = [];
      usersLoadedQuery.value = null;
      usersError.value = true;
    } finally {
      if (activeController === controller) {
        activeController = null;
        usersLoading.value = false;
      }
    }
  };

  const debouncedFetchUsers = useDebounceFn(fetchUsers, 350);

  const search = async () => {
    usersLoadedQuery.value = null;

    if (!isSearching.value) {
      await fetchUsers();
      return;
    }

    usersLoading.value = true;
    activeController?.abort();
    activeController = null;
    await debouncedFetchUsers();
  };

  const closeSearch = () => {
    query.value = '';
    users.value = [];
    usersError.value = false;
    usersLoading.value = false;
    usersLoadedQuery.value = null;
    activeController?.abort();
    activeController = null;
  };

  const init = () => {
    randomSeed.value = Math.random();
  };

  const dispose = () => {
    activeController?.abort();
    activeController = null;
  };

  function $reset() {
    closeSearch();
    randomSeed.value = 0;
  }

  return {
    query,
    usersLoading,
    usersError,
    isSearching,
    suggestedDialogs,
    contactResults,
    search,
    closeSearch,
    init,
    dispose,
    $reset,
  };
});
