import { defineStore } from 'pinia';
import type { User } from '~/types';
import { mergeUsersById } from '~/utils/merge-users-by-id';

export type UsersSortBy = 'lastSeen' | 'name';

type UsersResponse = {
  ok: boolean;
  users: User[];
  has_more: boolean;
  total: number;
};

export const useUsersStore = defineStore('users', () => {
  const searchMode = ref(false);
  const searchLoading = ref(false);
  const searchError = ref(false);
  const searchQuery = ref('');
  const searchList = ref<User[]>([]);
  let searchSequence = 0;
  const invalidateSearch = () => {
    searchSequence += 1;
    searchList.value = [];
    searchError.value = false;
    searchLoading.value = Boolean(searchQuery.value.trim());
  };
  const fetchSearchData = async () => {
    const requestId = ++searchSequence;
    const query = searchQuery.value.trim();
    searchError.value = false;
    if (!query) {
      searchList.value = [];
      searchLoading.value = false;
      return;
    }
    searchLoading.value = true;
    try {
      const data = await $http<UsersResponse>('users', { query: { q: query } });
      if (requestId === searchSequence) searchList.value = data.users ?? [];
    } catch {
      if (requestId === searchSequence) searchError.value = true;
    } finally {
      if (requestId === searchSequence) searchLoading.value = false;
    }
  };

  const closeSearch = async () => {
    searchQuery.value = '';
    invalidateSearch();
    searchMode.value = false;
  };

  const list = ref<User[]>([]);
  const total = ref(0);
  const hasMore = ref(true);
  const sortBy = ref<UsersSortBy>('lastSeen');

  const page = ref(1);
  const pageInLoading = ref(true);
  let requestSequence = 0;
  let pendingRequestId: number | null = null;

  const loading = ref(true);
  const error = ref(false);
  const fetchData = async () => {
    if (pendingRequestId === requestSequence || !hasMore.value) return;
    const requestId = requestSequence;
    pendingRequestId = requestId;
    const requestedPage = page.value;
    const requestedSort = sortBy.value;

    loading.value = true;
    error.value = false;
    try {
      const data = await $http<UsersResponse>('users', {
        query: {
          per_page: 28,
          page: requestedPage,
          sort_by: requestedSort === 'name' ? 'name' : 'last_seen',
        },
      });

      if (requestId !== requestSequence) return;

      list.value = mergeUsersById(list.value, data.users ?? []);
      total.value = data.total ?? 0;
      page.value = requestedPage + 1;
      hasMore.value = data.has_more ?? false;
      pageInLoading.value = false;
    } catch (e) {
      if (requestId !== requestSequence) return;

      error.value = true;
      pageInLoading.value = false;
    } finally {
      if (pendingRequestId === requestId) pendingRequestId = null;
      if (requestId === requestSequence) loading.value = false;
    }
  };

  const setSortBy = async (value: UsersSortBy) => {
    if (sortBy.value === value) return;

    requestSequence += 1;
    sortBy.value = value;
    list.value = [];
    total.value = 0;
    hasMore.value = true;
    page.value = 1;
    pageInLoading.value = true;
    loading.value = false;
    error.value = false;

    await fetchData();
  };

  const clearData = async () => {
    requestSequence += 1;
    list.value = [];
    total.value = 0;
    hasMore.value = true;
    page.value = 1;
    pageInLoading.value = true;
    loading.value = false;
    error.value = false;
    await closeSearch();
  };

  function $reset() {
    requestSequence += 1;
    list.value = [];
    total.value = 0;
    hasMore.value = true;
    sortBy.value = 'lastSeen';
    page.value = 1;
    pageInLoading.value = true;
    loading.value = true;
    error.value = false;
    searchMode.value = false;
    searchQuery.value = '';
    searchList.value = [];
    searchSequence += 1;
    searchError.value = false;
    searchLoading.value = false;
  }
  return {
    searchMode,
    searchQuery,
    searchList,
    searchLoading,
    searchError,
    invalidateSearch,

    list,
    total,

    hasMore,
    sortBy,
    loading,
    pageInLoading,
    error,

    fetchData,
    setSortBy,
    clearData,
    fetchSearchData,
    closeSearch,
    $reset,
  };
});
