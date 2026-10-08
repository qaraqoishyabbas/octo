import { defineStore } from 'pinia';
import { reactive, ref } from 'vue';
import type { Dialog } from '~/types';

export const useProfileDetailsStore = defineStore('profile-details', () => {
  const scopes = ref<
    Record<
      string,
      {
        profile: Dialog | null;
        loading: boolean;
        saving: boolean;
        error: boolean;
        sequence: number;
      }
    >
  >({});
  let nextScope = 0;
  const createScope = () => {
    const key = String(++nextScope);
    const state = reactive({
      profile: null as Dialog | null,
      loading: false,
      saving: false,
      error: false,
      sequence: 0,
    });
    scopes.value[key] = state;
    const $reset = () => {
      state.sequence++;
      Object.assign(state, { profile: null, loading: false, saving: false, error: false });
    };
    const fetchData = async (target: string) => {
      $reset();
      if (!target.trim()) return;
      const sequence = state.sequence;
      state.loading = true;
      try {
        const data = await $http<{ dialog: Dialog }>(
          `dialogs/${encodeURIComponent(target.trim())}`,
        );
        if (sequence === state.sequence) state.profile = data?.dialog ?? null;
      } catch {
        if (sequence === state.sequence) state.error = true;
      } finally {
        if (sequence === state.sequence) state.loading = false;
      }
    };
    const save = async (
      target: string,
      body: { title: string; description: string | null; avatar: string | null },
    ) => {
      if (state.saving || !target.trim()) return;
      const sequence = ++state.sequence;
      state.loading = false;
      state.saving = true;
      state.error = false;
      try {
        const data = await $http<{ ok: boolean; dialog?: Dialog | null }>(
          `dialogs/${encodeURIComponent(target.trim())}`,
          { method: 'PATCH', body },
        );
        if (sequence !== state.sequence) return;
        if (!data?.ok || !data.dialog) throw new Error('Profile update failed');
        state.profile = data.dialog;
        useDialogsStore().updateDialogDetails(data.dialog);
        const dialog = useDialogStore();
        if (
          dialog.current &&
          (dialog.current.dialog_id === data.dialog.dialog_id ||
            dialog.current.username === data.dialog.username)
        )
          dialog.current = data.dialog;
        return data;
      } catch (error) {
        if (sequence !== state.sequence) return;
        state.error = true;
        throw error;
      } finally {
        if (sequence === state.sequence) state.saving = false;
      }
    };
    return {
      state,
      fetchData,
      save,
      $reset,
      dispose: () => {
        $reset();
        delete scopes.value[key];
      },
    };
  };
  const $reset = () =>
    Object.values(scopes.value).forEach((state) => {
      state.sequence++;
      Object.assign(state, { profile: null, loading: false, saving: false, error: false });
    });
  return { scopes, createScope, $reset };
});
