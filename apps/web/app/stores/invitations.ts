import { defineStore } from 'pinia';

export type InviteDialog = {
  dialog_id: string;
  title: string | null;
  description: string | null;
  avatar: string | null;
  type: 'G' | 'C';
  users_count: number;
  is_member: boolean;
};

export const useInvitationsStore = defineStore('invitations', () => {
  const current = ref<InviteDialog | null>(null);
  const token = ref('');
  const loading = ref(false);
  const error = ref(false);
  const joining = ref(false);
  const joinError = ref(false);
  let requestSequence = 0;

  const fetchData = async (value: string) => {
    const requestId = ++requestSequence;
    token.value = value.trim();
    current.value = null;
    error.value = false;
    joinError.value = false;
    joining.value = false;
    if (!token.value) {
      loading.value = false;
      error.value = true;
      return;
    }
    loading.value = true;
    try {
      const response = await $http<{ ok: boolean; dialog?: InviteDialog | null }>(
        `invites/${encodeURIComponent(token.value)}`,
      );
      if (requestId !== requestSequence) return;
      if (!response.ok || !response.dialog) throw new Error('Invite unavailable');
      current.value = response.dialog;
    } catch {
      if (requestId === requestSequence) error.value = true;
    } finally {
      if (requestId === requestSequence) loading.value = false;
    }
  };

  const join = async () => {
    if (!token.value || !current.value || joining.value) return null;
    if (current.value.is_member) return current.value.dialog_id;
    const requestId = requestSequence;
    joining.value = true;
    joinError.value = false;
    try {
      const response = await $http<{ ok: boolean; dialog_id?: string | null }>(
        `invites/${encodeURIComponent(token.value)}/join`,
        { method: 'POST' },
      );
      if (requestId !== requestSequence) return null;
      if (!response.ok || !response.dialog_id) throw new Error('Invite join failed');
      current.value.is_member = true;
      return response.dialog_id;
    } catch {
      if (requestId === requestSequence) joinError.value = true;
      return null;
    } finally {
      if (requestId === requestSequence) joining.value = false;
    }
  };

  function $reset() {
    requestSequence += 1;
    current.value = null;
    token.value = '';
    loading.value = false;
    error.value = false;
    joining.value = false;
    joinError.value = false;
  }

  return { current, token, loading, error, joining, joinError, fetchData, join, $reset };
});
