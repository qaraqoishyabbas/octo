import { defineStore } from 'pinia';
import type { Dialog, User } from '~/types';

type TypingUser = Pick<User, 'id' | 'name' | 'first_name' | 'last_name' | 'username' | 'avatar'>;
type TypingRecord = {
  user: TypingUser;
  expiresAt: number;
};

const TYPING_TTL_MS = 5000;
const TYPING_SWEEP_MS = 1000;

const userName = (user: Partial<TypingUser>) => {
  const fullName =
    String(user.name ?? '').trim() ||
    `${String(user.first_name ?? '').trim()} ${String(user.last_name ?? '').trim()}`.trim();

  return fullName || (user.username ? `@${user.username}` : 'Пользователь');
};

export const useDialogTypingStore = defineStore('dialog-typing', () => {
  const auth = useAuthStore();
  const typingByDialogId = ref<Record<string, Record<string, TypingRecord>>>({});
  const now = ref(Date.now());
  const lastTypingDialogId = ref<string | null>(null);
  let lastTypingSentAt = 0;
  let outgoingGeneration = 0;

  const sendSignal = async (dialogId: string, typing = true, force = false) => {
    if (!dialogId || !auth.token) return;
    const timestamp = Date.now();
    if (typing && !force && timestamp - lastTypingSentAt < 2500) return;
    const generation = outgoingGeneration;
    lastTypingSentAt = timestamp;
    lastTypingDialogId.value = typing ? dialogId : null;
    try {
      await $http('realtime/typing', {
        method: 'PATCH',
        body: { dialog_id: dialogId, typing },
      });
    } catch {
      if (generation === outgoingGeneration && !typing) lastTypingDialogId.value = null;
    }
  };

  const resetOutgoing = () => {
    outgoingGeneration += 1;
    lastTypingDialogId.value = null;
    lastTypingSentAt = 0;
  };
  let ticker: ReturnType<typeof window.setInterval> | null = null;

  const startTicker = () => {
    if (!import.meta.client || ticker) {
      return;
    }

    ticker = window.setInterval(() => {
      now.value = Date.now();
      cleanup();
    }, TYPING_SWEEP_MS);
  };

  const setTyping = (
    dialogId?: string | null,
    user?: Partial<TypingUser> | null,
    typing = true,
  ) => {
    const safeDialogId = String(dialogId ?? '').trim();
    const safeUserId = String(user?.id ?? '').trim();

    if (!safeDialogId || !safeUserId || safeUserId === String(auth.user?.id ?? '')) {
      return;
    }

    if (!typing) {
      delete typingByDialogId.value[safeDialogId]?.[safeUserId];
      return;
    }

    typingByDialogId.value[safeDialogId] = {
      ...(typingByDialogId.value[safeDialogId] ?? {}),
      [safeUserId]: {
        user: {
          id: safeUserId,
          name: String(user?.name ?? '').trim(),
          first_name: String(user?.first_name ?? '').trim(),
          last_name: String(user?.last_name ?? '').trim(),
          username: String(user?.username ?? '').trim(),
          avatar: user?.avatar ?? null,
        },
        expiresAt: Date.now() + TYPING_TTL_MS,
      },
    };
    now.value = Date.now();
  };

  const getTypingUsers = (dialogId?: string | null) => {
    const safeDialogId = String(dialogId ?? '').trim();
    const records = Object.values(typingByDialogId.value[safeDialogId] ?? {});

    return records.filter((record) => record.expiresAt > now.value).map((record) => record.user);
  };

  const getTypingUsersForDialog = (dialog?: Dialog | null) => {
    const type = String(dialog?.type ?? '').toUpperCase();
    const ids = [dialog?.dialog_id, dialog?.id, type && dialog?.id ? `${type}-${dialog.id}` : null]
      .map((id) => String(id ?? '').trim())
      .filter((id, index, items) => Boolean(id) && items.indexOf(id) === index);
    const uniqueUsers = new Map<string, TypingUser>();

    ids.forEach((dialogId) => {
      getTypingUsers(dialogId).forEach((user) => uniqueUsers.set(String(user.id), user));
    });

    return [...uniqueUsers.values()];
  };

  const getAudienceText = (dialog?: Dialog | null) => {
    if (String(dialog?.type ?? '').toUpperCase() === 'C') {
      return null;
    }

    const users = getTypingUsersForDialog(dialog);

    if (users.length === 0 || dialog?.is_self) {
      return null;
    }

    if (String(dialog?.type ?? '').toUpperCase() === 'D') {
      return 'Пишет...';
    }

    if (users.length === 1) {
      return `${userName(users[0])} пишет...`;
    }

    return `${userName(users[0])} и еще ${users.length - 1} пишут...`;
  };

  const cleanup = () => {
    const currentTime = Date.now();

    Object.entries(typingByDialogId.value).forEach(([dialogId, users]) => {
      Object.entries(users).forEach(([userId, record]) => {
        if (record.expiresAt <= currentTime) {
          delete typingByDialogId.value[dialogId][userId];
        }
      });

      if (Object.keys(typingByDialogId.value[dialogId]).length === 0) {
        delete typingByDialogId.value[dialogId];
      }
    });
  };

  function $reset() {
    resetOutgoing();
    typingByDialogId.value = {};
    now.value = Date.now();
  }

  startTicker();

  return {
    typingByDialogId,
    lastTypingDialogId,
    sendSignal,
    resetOutgoing,
    setTyping,
    getTypingUsers,
    getTypingUsersForDialog,
    getAudienceText,
    $reset,
  };
});
