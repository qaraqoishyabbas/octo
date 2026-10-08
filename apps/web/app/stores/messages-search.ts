import { defineStore } from 'pinia';
import type { ChatMessage } from '~/types';

export const MIN_MESSAGE_SEARCH_QUERY_LENGTH = 2;

export const useMessagesSearchStore = defineStore('messages-search', () => {
  const messages = useMessagesStore();
  const dialog = useDialogStore();
  const list = ref<ChatMessage[]>([]);
  const query = ref('');
  const loading = ref(false);
  const error = ref(false);
  const activeIndex = ref(-1);
  const hasResults = computed(() => list.value.length > 0);
  const hasPrev = computed(() => hasResults.value && activeIndex.value > 0);
  const hasNext = computed(() => hasResults.value && activeIndex.value < list.value.length - 1);
  let requestSequence = 0;
  let controller: AbortController | null = null;

  const invalidate = () => {
    requestSequence += 1;
    controller?.abort();
    controller = null;
    loading.value = false;
    error.value = false;
    list.value = [];
    activeIndex.value = -1;
  };

  const selectIndex = async (index: number) => {
    if (!list.value.length) return;
    const selected = Math.min(Math.max(index, 0), list.value.length - 1);
    activeIndex.value = selected;
    await messages.loadAroundMessage(list.value[selected]?.id, true);
  };

  const fetchData = async (value = query.value) => {
    invalidate();
    const normalizedQuery = value.trim();
    const dialogId = dialog.current?.dialog_id;
    if (!dialogId || normalizedQuery.length < MIN_MESSAGE_SEARCH_QUERY_LENGTH) return;
    const requestId = requestSequence;
    const activeController = new AbortController();
    controller = activeController;
    loading.value = true;
    try {
      const response = await $http<{ ok: boolean; data: ChatMessage[]; total: number }>(
        'messages/search',
        {
          query: { dialog_id: dialogId, q: normalizedQuery, limit: 50 },
          signal: activeController.signal,
        },
      );
      if (requestId !== requestSequence || dialog.current?.dialog_id !== dialogId) return;
      list.value = response?.data ?? [];
      if (list.value.length) await selectIndex(list.value.length - 1);
    } catch {
      if (requestId === requestSequence) error.value = true;
    } finally {
      if (requestId === requestSequence) {
        loading.value = false;
        controller = null;
      }
    }
  };

  function $reset() {
    invalidate();
    query.value = '';
  }

  return {
    list,
    query,
    loading,
    error,
    activeIndex,
    hasResults,
    hasPrev,
    hasNext,
    fetchData,
    selectIndex,
    invalidate,
    $reset,
  };
});
