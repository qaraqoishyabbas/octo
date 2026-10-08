import { defineStore } from 'pinia';
import type { DialogPreview } from '~/types';

type ChannelsResponse = {
  ok: boolean;
  channels: DialogPreview[];
  has_more: boolean;
  total: number;
};

export const useChannelsStore = defineStore('channels', () => {
  const list = ref<DialogPreview[]>([]);
  const total = ref(0);
  const page = ref(1);
  const hasMore = ref(true);
  const loading = ref(false);
  const pageInLoading = ref(true);
  const error = ref(false);
  const searchQuery = ref('');
  const searchList = ref<DialogPreview[]>([]);
  const searchLoading = ref(false);
  const searchError = ref(false);
  let requestSequence = 0;
  let searchSequence = 0;

  const fetchData = async (options?: { reset?: boolean }) => {
    const reset = Boolean(options?.reset);
    if (!reset && (loading.value || !hasMore.value)) return;
    if (reset) {
      requestSequence += 1;
      list.value = [];
      page.value = 1;
      total.value = 0;
      hasMore.value = true;
      pageInLoading.value = true;
    }
    const requestId = requestSequence;
    const requestedPage = page.value;
    loading.value = true;
    error.value = false;
    try {
      const response = await $http<ChannelsResponse>('channels', {
        query: { per_page: 28, page: requestedPage },
      });
      if (requestId !== requestSequence) return;
      const items = new Map(list.value.map((item) => [item.id, item]));
      (response.channels ?? []).forEach((item) => items.set(item.id, item));
      list.value = [...items.values()];
      total.value = response.total ?? 0;
      hasMore.value = Boolean(response.has_more);
      page.value = requestedPage + 1;
    } catch {
      if (requestId === requestSequence) error.value = true;
    } finally {
      if (requestId === requestSequence) {
        loading.value = false;
        pageInLoading.value = false;
      }
    }
  };

  const invalidateSearch = () => {
    searchSequence += 1;
    searchList.value = [];
    searchLoading.value = Boolean(searchQuery.value.trim());
    searchError.value = false;
  };

  const fetchSearchData = async () => {
    const query = searchQuery.value.trim();
    const requestId = ++searchSequence;
    searchList.value = [];
    searchError.value = false;
    if (!query) {
      searchLoading.value = false;
      return;
    }
    searchLoading.value = true;
    try {
      const response = await $http<ChannelsResponse>('channels', {
        query: { per_page: 28, q: query },
      });
      if (requestId === searchSequence) searchList.value = response.channels ?? [];
    } catch {
      if (requestId === searchSequence) searchError.value = true;
    } finally {
      if (requestId === searchSequence) searchLoading.value = false;
    }
  };

  const closeSearch = () => {
    searchQuery.value = '';
    invalidateSearch();
  };

  function $reset() {
    requestSequence += 1;
    list.value = [];
    total.value = 0;
    page.value = 1;
    hasMore.value = true;
    loading.value = false;
    pageInLoading.value = true;
    error.value = false;
    closeSearch();
  }

  return {
    list,
    total,
    page,
    hasMore,
    loading,
    pageInLoading,
    error,
    searchQuery,
    searchList,
    searchLoading,
    searchError,
    fetchData,
    fetchSearchData,
    invalidateSearch,
    closeSearch,
    $reset,
  };
});
