import { defineStore } from 'pinia';
import type { Dialog } from '~/types';

type DialogResponse = {
  ok: boolean;
  dialog: Dialog;
};

export const useDialogStore = defineStore('dialog', () => {
  const dialogs = useDialogsStore();
  const usersOnline = useUsersOnlineStore();
  const current = ref<Dialog | null>(null);
  const loading = ref(false);
  const error = ref(false);
  const currentTarget = ref<string | null>(null);
  const requestSequence = ref(0);
  const searchOpen = ref(false);
  let activeController: AbortController | null = null;

  const messages = useMessagesStore();

  const fetchData = async (target: string, requestId = requestSequence.value) => {
    activeController?.abort();
    const controller = new AbortController();
    activeController = controller;

    loading.value = true;
    error.value = false;

    try {
      const data = await $http<DialogResponse>(`dialogs/${target}`, {
        signal: controller.signal,
      });
      if (requestId !== requestSequence.value) {
        return;
      }
      current.value = data?.dialog ?? null;
      const lastSeenAt = current.value?.last_seen_at;
      if (current.value?.type === 'D' && current.value.author_id && lastSeenAt !== undefined) {
        usersOnline.setBackendLastSeen(current.value.author_id, lastSeenAt);
      }
    } catch (e) {
      if (requestId !== requestSequence.value) {
        return;
      }
      if (e instanceof DOMException && e.name === 'AbortError') {
        return;
      }
      current.value = null;
      error.value = true;
    } finally {
      if (requestId === requestSequence.value && activeController === controller) {
        activeController = null;
        loading.value = false;
      }
    }
  };

  const setCurrent = async (target: string) => {
    if (currentTarget.value !== target) {
      requestSequence.value += 1;
      currentTarget.value = target;
      current.value = null;
      searchOpen.value = false;
      messages.$reset();
    }

    const requestId = requestSequence.value;
    const inList = dialogs.list.find(
      (item) => item.dialog_id === target || item.username === target,
    );

    if (inList) {
      current.value = inList;
      error.value = false;
      loading.value = false;
      return;
    }

    await fetchData(target, requestId);
  };

  const openSearch = () => {
    searchOpen.value = true;
  };

  function $reset() {
    requestSequence.value += 1;
    activeController?.abort();
    activeController = null;
    currentTarget.value = null;
    current.value = null;
    loading.value = false;
    error.value = false;
    searchOpen.value = false;
  }

  return {
    current,
    loading,
    error,
    searchOpen,
    fetchData,
    setCurrent,
    openSearch,
    $reset,
  };
});
