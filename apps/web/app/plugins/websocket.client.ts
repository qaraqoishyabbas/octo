import type { ChatMessage } from '~/types';
import { getDialogRealtimeChannel } from '~/utils/dialog-realtime';

type RealtimeMessagePayload = {
  dialog_id?: string;
  dialog_public_id?: string;
  message?: ChatMessage;
  message_id?: string;
};

type RealtimeMembershipPayload = RealtimeMessagePayload & {
  action?: 'added' | 'joined' | 'removed' | 'left' | string;
  user_id?: string;
};

type RealtimePresencePayload = {
  user_id?: string;
  last_seen_at?: string | null;
};

type RealtimeTypingPayload = {
  dialog_id?: string;
  dialog_public_id?: string;
  typing?: boolean;
  user?: {
    id?: string;
    name?: string;
    first_name?: string;
    last_name?: string;
    username?: string;
    avatar?: string | null;
  };
};

export default defineNuxtPlugin(() => {
  const auth = useAuthStore();
  const websocket = useWebSocketStore();
  const dialogs = useDialogsStore();
  const dialog = useDialogStore();
  const messages = useMessagesStore();
  const usersOnline = useUsersOnlineStore();
  const dialogTyping = useDialogTypingStore();

  let currentUserChannel: string | null = null;
  let currentDialogChannel: string | null = null;

  const isCurrentDialog = (payload: RealtimeMessagePayload) =>
    Boolean(
      dialog.current &&
      (dialog.current.id === payload.dialog_id ||
        dialog.current.dialog_id === payload.dialog_public_id),
    );

  const publicDialogId = (payload: RealtimeMessagePayload) =>
    String(payload.dialog_public_id || payload.dialog_id || '').trim();

  const normalizeMessage = (message?: ChatMessage | null): ChatMessage | null => {
    if (!message?.id) {
      return null;
    }

    const currentUserId = String(auth.user?.id ?? '');

    return {
      ...message,
      is_sender: Boolean(message.sender_id && String(message.sender_id) === currentUserId),
      reply_to: message.reply_to ? normalizeMessage(message.reply_to) : message.reply_to,
    };
  };

  const refreshDialog = async (payload: RealtimeMessagePayload) => {
    const dialogId = publicDialogId(payload);

    if (!dialogId) {
      await dialogs.fetchData();
      return;
    }

    await dialogs.refreshById(dialogId);

    const refreshed = dialogs.list.find(
      (item) => item.id === payload.dialog_id || item.dialog_id === dialogId,
    );
    if (refreshed && isCurrentDialog(payload)) {
      dialog.current = refreshed;
    }
  };

  const syncCreatedMessagePreview = (payload: RealtimeMessagePayload, message: ChatMessage) => {
    const incrementUnread = !message.is_sender;
    const syncedDialog = dialogs.receiveMessagePreview(publicDialogId(payload), message, {
      incrementUnread,
      currentUserId: auth.user?.id,
    });

    if (dialog.current && isCurrentDialog(payload) && dialog.current !== syncedDialog) {
      dialogs.applyMessagePreview(dialog.current, message, {
        incrementUnread,
        currentUserId: auth.user?.id,
      });
    }

    return Boolean(syncedDialog || isCurrentDialog(payload));
  };

  const sendHeartbeat = () => usersOnline.sendHeartbeat();

  const handleMessageCreated = (payload: RealtimeMessagePayload) => {
    void (async () => {
      const message = normalizeMessage(payload.message);

      if (message && isCurrentDialog(payload)) {
        await messages.receiveMessage(message, message.is_sender);
      }

      if (message && syncCreatedMessagePreview(payload, message)) {
        return;
      }

      await refreshDialog(payload);
    })();
  };

  const handleMessageUpdated = (payload: RealtimeMessagePayload) => {
    void (async () => {
      const message = normalizeMessage(payload.message);

      if (message && isCurrentDialog(payload)) {
        messages.receiveMessageUpdate(message);
      }

      await refreshDialog(payload);
    })();
  };

  const handleMessageDeleted = (payload: RealtimeMessagePayload) => {
    void (async () => {
      if (payload.message_id && isCurrentDialog(payload)) {
        messages.receiveMessageDeleted(payload.message_id);
      }

      await refreshDialog(payload);
    })();
  };

  const handleMessagePinned = (payload: RealtimeMessagePayload) => {
    const message = normalizeMessage(payload.message);
    if (message && isCurrentDialog(payload)) {
      messages.receiveMessageUpdate(message);
    }
  };

  const handleMembershipChanged = (payload: RealtimeMembershipPayload) => {
    void (async () => {
      const affectedUserId = String(payload.user_id ?? '');
      const currentUserId = String(auth.user?.id ?? '');
      const dialogId = publicDialogId(payload);
      const isRemovedCurrentUser =
        ['removed', 'left'].includes(String(payload.action)) && affectedUserId === currentUserId;

      if (isRemovedCurrentUser) {
        dialogs.removeById(dialogId || String(payload.dialog_id ?? ''));

        if (isCurrentDialog(payload)) {
          messages.$reset();
          dialog.$reset();
          await navigateTo('/');
        }

        return;
      }

      const message = normalizeMessage(payload.message);
      if (message && isCurrentDialog(payload)) {
        await messages.receiveMessage(message);
      }

      await refreshDialog(payload);
    })();
  };

  websocket.on('dialog.message.created', (data) =>
    handleMessageCreated(data as RealtimeMessagePayload),
  );
  websocket.on('dialog.message.updated', (data) =>
    handleMessageUpdated(data as RealtimeMessagePayload),
  );
  websocket.on('dialog.message.pinned', (data) =>
    handleMessagePinned(data as RealtimeMessagePayload),
  );
  websocket.on('dialog.message.deleted', (data) =>
    handleMessageDeleted(data as RealtimeMessagePayload),
  );
  websocket.on('dialog.membership.changed', (data) =>
    handleMembershipChanged(data as RealtimeMembershipPayload),
  );
  websocket.on('dialog.typing', (data) => {
    const payload = data as RealtimeTypingPayload;
    dialogTyping.setTyping(
      String(payload.dialog_public_id || payload.dialog_id || '').trim(),
      payload.user,
      payload.typing ?? true,
    );
  });
  websocket.on('client-dialog.typing', (data) => {
    const payload = data as RealtimeTypingPayload;
    dialogTyping.setTyping(
      String(payload.dialog_public_id || payload.dialog_id || '').trim(),
      payload.user,
      payload.typing ?? true,
    );
  });
  websocket.on('user.presence.updated', (data) => {
    const payload = data as RealtimePresencePayload;
    usersOnline.setWebSocketLastSeen(payload.user_id, payload.last_seen_at ?? null);
  });

  watch(
    () => auth.token,
    (token) => {
      if (token) {
        websocket.start();
        return;
      }

      websocket.stop();
    },
    { immediate: true },
  );

  watch(
    () => [auth.token, auth.user?.id] as const,
    ([token, userId]) => {
      const nextChannel = token && userId ? `user.${userId}` : null;

      if (currentUserChannel && currentUserChannel !== nextChannel) {
        websocket.unsubscribe(currentUserChannel);
        currentUserChannel = null;
      }

      if (!nextChannel || currentUserChannel === nextChannel) {
        return;
      }

      currentUserChannel = nextChannel;
      websocket.subscribePrivate(nextChannel);
    },
    { immediate: true },
  );

  watch(
    () =>
      [
        auth.token,
        dialog.current?.dialog_id,
        dialog.current?.type,
        dialog.current?.role,
        dialog.current?.message?.id,
      ] as const,
    ([token, dialogId, type, role, messageId]) => {
      const nextChannel = getDialogRealtimeChannel({ token, dialogId, type, role, messageId });

      if (currentDialogChannel && currentDialogChannel !== nextChannel) {
        websocket.unsubscribe(currentDialogChannel);
        currentDialogChannel = null;
      }

      if (!nextChannel || currentDialogChannel === nextChannel) {
        return;
      }

      currentDialogChannel = nextChannel;
      websocket.subscribePrivate(nextChannel);
    },
    { immediate: true },
  );

  window.addEventListener('online', () => {
    if (auth.token) {
      websocket.start();
    }
  });

  window.addEventListener('offline', () => {
    websocket.stop();
  });

  watch(
    () => websocket.status,
    (status, previousStatus) => {
      if (status !== 'connected' || !auth.token) {
        return;
      }

      void sendHeartbeat();

      if (previousStatus !== 'connected') {
        void dialogs.fetchData();
      }
    },
  );

  watch(
    () => websocket.lastPongAt,
    () => {
      void sendHeartbeat();
    },
  );
});
