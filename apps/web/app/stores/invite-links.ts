import { defineStore } from 'pinia';
import { reactive, ref } from 'vue';

export const useInviteLinksStore = defineStore('invite-links', () => {
  const scopes = ref<
    Record<string, { token: string; loading: boolean; error: boolean; sequence: number }>
  >({});
  let nextScope = 0;
  const resetState = (state: (typeof scopes.value)[string]) => {
    state.sequence++;
    Object.assign(state, { token: '', loading: false, error: false });
  };
  const createScope = () => {
    const key = String(++nextScope);
    const state = reactive({ token: '', loading: false, error: false, sequence: 0 });
    scopes.value[key] = state;
    const $reset = () => resetState(state);
    const fetchData = async (target: string) => {
      $reset();
      if (!target.trim()) return;
      const sequence = state.sequence;
      state.loading = true;
      try {
        const response = await $http<{ ok: boolean; token?: string }>(
          `dialogs/${encodeURIComponent(target.trim())}/invite-link`,
          { method: 'POST' },
        );
        if (sequence !== state.sequence) return;
        const token = String(response?.token ?? '').trim();
        if (!response?.ok || !token) throw new Error('Invite token is empty');
        state.token = token;
        return token;
      } catch (error) {
        if (sequence !== state.sequence) return;
        state.error = true;
        throw error;
      } finally {
        if (sequence === state.sequence) state.loading = false;
      }
    };
    return {
      state,
      fetchData,
      $reset,
      dispose: () => {
        $reset();
        delete scopes.value[key];
      },
    };
  };
  const $reset = () => Object.values(scopes.value).forEach(resetState);
  return { scopes, createScope, $reset };
});
