import { defineStore } from 'pinia';
import type { ChatMessage, Dialog, DialogType } from '~/types';

export type DialogFilter = 'all' | 'unread' | 'direct' | 'groups' | 'channels' | 'archive';

type DialogsResponse = {
  ok: boolean;
  dialogs: Dialog[];
  total: number;
};

type DialogResponse = {
  ok: boolean;
  dialog: Dialog;
};

type DialogFlagResponse = {
  ok: boolean;
  muted?: boolean;
  pinned?: boolean;
  archived?: boolean;
};

type DialogReadResponse = {
  ok: boolean;
  counter: number;
  last_read_at: string | null;
  first_unread_message_id?: string | null;
  has_reminder?: boolean;
};

type DialogLeaveResponse = {
  ok: boolean;
  left: boolean;
  dialog_id: string;
};

type MessagePreviewOptions = {
  incrementUnread?: boolean;
  currentUserId?: string | null;
};

export const useDialogsStore = defineStore('dialogs', () => {
  const toast = useToast();
  const list = ref<Dialog[]>([]);
  const activeFilter = ref<DialogFilter>('all');
  const loading = ref(true);
  const error = ref(false);
  const creatingGroup = ref(false);
  const creatingChannel = ref(false);
  const createError = ref(false);
  const joiningDialogIds = ref<string[]>([]);
  let generation = 0;
  let fetchRequestSequence = 0;
  const usersOnline = useUsersOnlineStore();
  const filterOptions: { value: DialogFilter; label: string; type?: DialogType }[] = [
    { value: 'all', label: 'Все' },
    { value: 'unread', label: 'Новые' },
    { value: 'direct', label: 'Личные', type: 'D' },
    { value: 'groups', label: 'Группы', type: 'G' },
    { value: 'channels', label: 'Каналы', type: 'C' },
    { value: 'archive', label: 'Архив' },
  ];

  const syncDialogOnlineStatus = (dialog?: Dialog | null) => {
    const lastSeenAt = dialog?.last_seen_at;

    if (dialog?.type !== 'D' || !dialog.author_id || lastSeenAt === undefined) {
      return;
    }

    usersOnline.setBackendLastSeen(dialog.author_id, lastSeenAt);
  };

  const fetchData = async () => {
    const requestId = ++fetchRequestSequence;
    const requestGeneration = generation;
    loading.value = true;
    error.value = false;
    try {
      const data = await $http<DialogsResponse>('dialogs');
      if (requestId !== fetchRequestSequence || requestGeneration !== generation) return;
      list.value = data?.dialogs ?? [];
      list.value.forEach(syncDialogOnlineStatus);
      sortList();
    } catch (e) {
      if (requestId === fetchRequestSequence && requestGeneration === generation)
        error.value = true;
    } finally {
      if (requestId === fetchRequestSequence && requestGeneration === generation)
        loading.value = false;
    }
  };

  const sortList = () => {
    list.value.sort((a, b) => {
      if (a.pinned !== b.pinned) {
        return Number(b.pinned) - Number(a.pinned);
      }

      const activityDiff =
        (b.message?.created_at ? Date.parse(b.message.created_at) : 0) -
        (a.message?.created_at ? Date.parse(a.message.created_at) : 0);

      if (activityDiff !== 0) {
        return activityDiff;
      }

      return String(b.id).localeCompare(String(a.id));
    });
  };

  const filteredList = computed(() => {
    return list.value.filter((dialog) => {
      if (activeFilter.value === 'archive') {
        return dialog.archived;
      }

      if (dialog.archived) {
        return false;
      }

      if (activeFilter.value === 'unread') {
        return (dialog.counter ?? 0) > 0 || Boolean(dialog.has_reminder);
      }

      const filter = filterOptions.find((item) => item.value === activeFilter.value);

      return !filter?.type || dialog.type === filter.type;
    });
  });

  const setFilter = (filter: DialogFilter) => {
    activeFilter.value = filter;
  };

  const replaceDialog = (dialog: Dialog) => {
    const index = list.value.findIndex((item) => item.dialog_id === dialog.dialog_id);

    if (index === -1) {
      list.value.unshift(dialog);
      sortList();
      return;
    }

    list.value[index] = dialog;
    sortList();
  };

  const updateDialogFlag = (
    dialogId: string,
    flag: 'muted' | 'pinned' | 'archived',
    value: boolean,
  ) => {
    const dialog = list.value.find((item) => item.dialog_id === dialogId);

    if (!dialog) {
      return;
    }

    dialog[flag] = value;
    sortList();
  };

  const updateDialogDetails = (dialog: Dialog) => {
    const current = list.value.find((item) => item.dialog_id === dialog.dialog_id);

    if (!current) {
      replaceDialog(dialog);
      return;
    }

    current.title = dialog.title;
    current.description = dialog.description;
    current.avatar = dialog.avatar;
  };

  const messageMentionsUser = (message: ChatMessage, userId?: string | null) => {
    const safeUserId = String(userId ?? '').trim();

    if (!safeUserId) {
      return false;
    }

    return (
      message.message.includes(`[@ id="${safeUserId}"`) ||
      message.message.includes(`[@ id='${safeUserId}'`) ||
      message.message.includes(`data-id="${safeUserId}"`) ||
      message.message.includes(`data-id='${safeUserId}'`)
    );
  };

  const applyMessagePreview = (
    dialog: Dialog,
    message: ChatMessage,
    options: MessagePreviewOptions = {},
  ) => {
    dialog.message = message;

    if (options.incrementUnread) {
      dialog.counter = (dialog.counter ?? 0) + 1;
      dialog.first_unread_message_id = dialog.first_unread_message_id || message.id;
      if (messageMentionsUser(message, options.currentUserId)) {
        dialog.has_reminder = true;
      }
    }
  };

  const receiveMessagePreview = (
    dialogId: string,
    message: ChatMessage,
    options: MessagePreviewOptions = {},
  ) => {
    const dialog = list.value.find(
      (item) => item.dialog_id === dialogId || item.id === message.dialog_id,
    );

    if (!dialog) {
      return null;
    }

    applyMessagePreview(dialog, message, options);
    sortList();
    return dialog;
  };

  const syncMessage = (dialogId: string, message: ChatMessage) => {
    return Boolean(receiveMessagePreview(dialogId, message));
  };

  const removeById = (dialogId: string) => {
    list.value = list.value.filter((item) => item.id !== dialogId && item.dialog_id !== dialogId);
  };

  const updateReadState = (
    dialogId: string,
    counter: number,
    lastReadAt: string | null,
    firstUnreadMessageId?: string | null,
  ) => {
    const dialog = list.value.find((item) => item.dialog_id === dialogId);

    if (!dialog) {
      return;
    }

    dialog.counter = counter;
    dialog.last_read_at = lastReadAt;
    if (firstUnreadMessageId !== undefined) {
      dialog.first_unread_message_id = firstUnreadMessageId;
    }
    if (counter <= 0) {
      dialog.has_reminder = false;
    }
  };

  const getUnreadCounter = (dialogId: string) => {
    const dialog = list.value.find((item) => item.dialog_id === dialogId);
    return dialog?.counter ?? null;
  };

  const readUntil = async (dialogId: string, messageId?: string | null) => {
    const counter = getUnreadCounter(dialogId);

    if (counter !== null && counter <= 0) {
      return null;
    }

    const data = await $http<DialogReadResponse>(`dialogs/${dialogId}/read`, {
      method: 'PATCH',
      body: messageId ? { message_id: messageId } : undefined,
    });

    if (data?.ok) {
      updateReadState(
        dialogId,
        data.counter ?? 0,
        data.last_read_at ?? null,
        data.first_unread_message_id ?? null,
      );
      const dialog = list.value.find((item) => item.dialog_id === dialogId);
      if (dialog && typeof data.has_reminder === 'boolean') {
        dialog.has_reminder = data.has_reminder;
      }
    }

    return data;
  };

  const readAll = async (dialogId: string) => {
    const counter = getUnreadCounter(dialogId);

    if (counter !== null && counter <= 0) {
      return;
    }

    await readUntil(dialogId);
  };

  const refreshById = async (dialogId: string) => {
    const requestGeneration = generation;
    try {
      const data = await $http<DialogResponse>(`dialogs/${dialogId}`);
      if (requestGeneration !== generation) return;
      const dialog = data?.dialog;

      if (!dialog) {
        return;
      }

      replaceDialog(dialog);
      syncDialogOnlineStatus(dialog);
    } catch (e) {
      if (requestGeneration !== generation) return;
      toast.add({
        title: 'Не удалось обновить диалог',
        description: dialogId,
        color: 'error',
        icon: 'i-ph-warning-circle-fill',
        progress: false,
        duration: 2000,
        close: false,
      });
    }
  };

  const mute = async (dialogId: string) => {
    const data = await $http<DialogFlagResponse>(`dialogs/${dialogId}/mute`, {
      method: 'PATCH',
    });

    if (typeof data?.muted === 'boolean') {
      updateDialogFlag(dialogId, 'muted', data.muted);
    }

    return data;
  };

  const pin = async (dialogId: string) => {
    const data = await $http<DialogFlagResponse>(`dialogs/${dialogId}/pin`, {
      method: 'PATCH',
    });

    if (typeof data?.pinned === 'boolean') {
      updateDialogFlag(dialogId, 'pinned', data.pinned);
    }

    return data;
  };

  const archive = async (dialogId: string) => {
    const data = await $http<DialogFlagResponse>(`dialogs/${dialogId}/archive`, {
      method: 'PATCH',
    });

    if (typeof data?.archived === 'boolean') {
      updateDialogFlag(dialogId, 'archived', data.archived);
    }

    return data;
  };

  const leave = async (dialogId: string) => {
    const data = await $http<DialogLeaveResponse>(`dialogs/${encodeURIComponent(dialogId)}/leave`, {
      method: 'DELETE',
    });

    if (data?.ok && data.left) {
      list.value = list.value.filter((item) => item.dialog_id !== data.dialog_id);
    }
  };

  const createDialog = async (
    type: 'group' | 'channel',
    body: { title: string; description?: string; avatar?: string | null; users?: string[] },
  ) => {
    const pending = type === 'group' ? creatingGroup : creatingChannel;
    if (pending.value) return null;
    const requestGeneration = generation;
    pending.value = true;
    createError.value = false;
    try {
      const response = await $http<{ ok: boolean; data?: string | null }>(type, {
        method: 'POST',
        body,
      });
      const target = response?.data;
      if (requestGeneration !== generation) return null;
      if (!response.ok || !target) throw new Error('Dialog creation failed');
      await refreshById(target);
      return requestGeneration === generation ? target : null;
    } catch (error) {
      if (requestGeneration !== generation) return null;
      createError.value = true;
      throw error;
    } finally {
      if (requestGeneration === generation) pending.value = false;
    }
  };

  const createGroup = (body: { title: string; users: string[]; avatar?: string | null }) =>
    createDialog('group', body);
  const createChannel = (body: { title: string; description: string; avatar?: string | null }) =>
    createDialog('channel', body);

  const join = async (dialogId: string) => {
    if (joiningDialogIds.value.includes(dialogId)) return null;
    const requestGeneration = generation;
    joiningDialogIds.value.push(dialogId);
    try {
      const response = await $http<{ ok: boolean; dialog_id: string }>(
        `dialogs/${encodeURIComponent(dialogId)}/join`,
        { method: 'POST' },
      );
      return requestGeneration === generation ? response : null;
    } finally {
      if (requestGeneration === generation) {
        joiningDialogIds.value = joiningDialogIds.value.filter((id) => id !== dialogId);
      }
    }
  };

  function $reset() {
    generation += 1;
    fetchRequestSequence += 1;
    list.value = [];
    activeFilter.value = 'all';
    loading.value = true;
    error.value = false;
    creatingGroup.value = false;
    creatingChannel.value = false;
    createError.value = false;
    joiningDialogIds.value = [];
  }

  return {
    list,
    filteredList,
    activeFilter,
    filterOptions,
    loading,
    error,
    creatingGroup,
    creatingChannel,
    createError,
    joiningDialogIds,
    createGroup,
    createChannel,
    join,
    setFilter,
    fetchData,
    readAll,
    readUntil,
    refreshById,
    mute,
    pin,
    archive,
    replaceDialog,
    removeById,
    applyMessagePreview,
    receiveMessagePreview,
    syncMessage,
    updateDialogDetails,
    updateReadState,
    sortList,
    leave,
    $reset,
  };
});
