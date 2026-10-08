import { defineStore } from 'pinia';
import type { ChatMessage } from '~/types';

type DraftScope = {
  userId?: string | null;
  dialogId?: string | null;
};

type DraftPayload = DraftScope & {
  content?: string | null;
  replyMessage?: ChatMessage | null;
};

const STORAGE_PREFIX = 'octo:messages-draft:v1';

export type MessageDraft = {
  content: string;
  replyMessage: ChatMessage | null;
};

const storage = () => (import.meta.client ? window.localStorage : null);

const normalize = (value?: string | null) => String(value ?? '').trim();

const storageKey = ({ userId, dialogId }: DraftScope) => {
  const safeUserId = normalize(userId);
  const safeDialogId = normalize(dialogId);

  if (!safeUserId || !safeDialogId) {
    return null;
  }

  return `${STORAGE_PREFIX}:${safeUserId}:${safeDialogId}`;
};

export const useMessagesDraftStore = defineStore('messages-draft', () => {
  const list = ref<Record<string, MessageDraft>>({});
  const loadedUsers = new Set<string>();

  const parseDraft = (value?: string | null): MessageDraft => {
    if (!value) {
      return {
        content: '',
        replyMessage: null,
      };
    }

    try {
      const parsed = JSON.parse(value) as Partial<MessageDraft> | string | null;

      if (typeof parsed === 'string') {
        return {
          content: parsed,
          replyMessage: null,
        };
      }

      return {
        content: String(parsed?.content ?? ''),
        replyMessage: parsed?.replyMessage ?? null,
      };
    } catch {
      return {
        content: value,
        replyMessage: null,
      };
    }
  };

  const serializeDraft = (draft: MessageDraft) => JSON.stringify(draft);

  const get = (scope: DraftScope) => {
    return getDraft(scope).content;
  };

  const getDraft = (scope: DraftScope): MessageDraft => {
    const key = storageKey(scope);

    if (!key) {
      return {
        content: '',
        replyMessage: null,
      };
    }

    return (
      list.value[key] ?? {
        content: '',
        replyMessage: null,
      }
    );
  };

  const loadUser = (userId?: string | null) => {
    const safeUserId = normalize(userId);
    const localStorage = storage();

    if (!safeUserId || !localStorage || loadedUsers.has(safeUserId)) {
      return;
    }

    const userPrefix = `${STORAGE_PREFIX}:${safeUserId}:`;

    Object.keys(localStorage)
      .filter((key) => key.startsWith(userPrefix))
      .forEach((key) => {
        const value = localStorage.getItem(key);

        if (value) {
          list.value[key] = parseDraft(value);
        }
      });

    loadedUsers.add(safeUserId);
  };

  const set = ({ content, ...scope }: DraftPayload) => {
    const key = storageKey(scope);
    const value = String(content ?? '').trim();
    const replyMessage = scope.replyMessage ?? null;

    if (!key) {
      return;
    }

    if (!value && !replyMessage) {
      remove(scope);
      return;
    }

    const draft = {
      content: value,
      replyMessage,
    };

    list.value[key] = draft;
    storage()?.setItem(key, serializeDraft(draft));
  };

  const remove = (scope: DraftScope) => {
    const key = storageKey(scope);

    if (!key) {
      return;
    }

    delete list.value[key];
    storage()?.removeItem(key);
  };

  const clearUser = (userId?: string | null) => {
    const safeUserId = normalize(userId);
    const localStorage = storage();

    if (!safeUserId || !localStorage) {
      return;
    }

    const userPrefix = `${STORAGE_PREFIX}:${safeUserId}:`;

    Object.keys(localStorage)
      .filter((key) => key.startsWith(userPrefix))
      .forEach((key) => {
        delete list.value[key];
        localStorage.removeItem(key);
      });

    loadedUsers.delete(safeUserId);
  };

  return {
    list,
    get,
    getDraft,
    loadUser,
    set,
    remove,
    clearUser,
  };
});
