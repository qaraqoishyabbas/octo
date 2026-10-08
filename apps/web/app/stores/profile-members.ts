import { defineStore } from 'pinia';
import { reactive, ref } from 'vue';
import type { ChatMessage, DialogMemberRole, DialogPermission, User } from '~/types';

type MemberScope = {
  list: User[];
  loading: boolean;
  error: boolean;
  mutationError: boolean;
  hasMore: boolean;
  page: number;
  softRefreshing: boolean;
  busyUserAction: string | null;
  saving: boolean;
  sequence: number;
  mutationSequence: number;
  target: string;
  role?: DialogMemberRole | null;
  roles?: string;
};
type UsersResponse = { users: User[]; has_more: boolean; total: number };

export const useProfileMembersStore = defineStore('profile-members', () => {
  const scopes = ref<Record<string, MemberScope>>({});
  let nextScope = 0;
  const resetState = (state: MemberScope) => {
    state.sequence++;
    state.mutationSequence++;
    Object.assign(state, {
      list: [],
      loading: false,
      error: false,
      mutationError: false,
      hasMore: true,
      page: 1,
      softRefreshing: false,
      busyUserAction: null,
      saving: false,
      target: '',
      role: undefined,
      roles: undefined,
    });
  };
  const createScope = () => {
    const key = String(++nextScope);
    const state = reactive<MemberScope>({
      list: [],
      loading: false,
      error: false,
      mutationError: false,
      hasMore: true,
      page: 1,
      softRefreshing: false,
      busyUserAction: null,
      saving: false,
      sequence: 0,
      mutationSequence: 0,
      target: '',
    });
    scopes.value[key] = state;
    const $reset = () => resetState(state);
    const fetchData = async (
      target: string,
      options?: {
        role?: DialogMemberRole | null;
        roles?: string;
        force?: boolean;
        soft?: boolean;
        all?: boolean;
      },
    ) => {
      target = target.trim();
      if (!target) {
        $reset();
        return;
      }
      if (
        (state.target &&
          (state.target !== target ||
            state.role !== options?.role ||
            state.roles !== options?.roles)) ||
        options?.force
      )
        $reset();
      if (state.loading || (!options?.soft && !state.hasMore)) return;
      state.target = target;
      state.role = options?.role;
      state.roles = options?.roles;
      const sequence = ++state.sequence;
      state.loading = true;
      state.softRefreshing = Boolean(options?.soft && state.list.length);
      state.error = false;
      try {
        let page = options?.soft || options?.all ? 1 : state.page;
        const users: User[] = [];
        let hasMore = true;
        do {
          const data = await $http<UsersResponse>(`dialogs/${encodeURIComponent(target)}/users`, {
            query: {
              page,
              per_page: options?.all ? 100 : 30,
              role: options?.role || undefined,
              roles: options?.roles,
            },
          });
          if (sequence !== state.sequence) return;
          users.push(...(data?.users ?? []));
          hasMore = Boolean(data?.has_more);
          page++;
        } while (options?.all && hasMore);
        const byId = new Map(
          (options?.soft || options?.all ? [] : state.list).map((user) => [user.id, user]),
        );
        users.forEach((user) => {
          byId.set(user.id, user);
          if (user.last_seen_at !== undefined)
            useUsersOnlineStore().setBackendLastSeen(user.id, user.last_seen_at);
        });
        state.list = [...byId.values()];
        state.hasMore = hasMore;
        state.page = page;
      } catch {
        if (sequence === state.sequence) state.error = true;
      } finally {
        if (sequence === state.sequence) {
          state.loading = false;
          state.softRefreshing = false;
        }
      }
    };
    const syncUser = (user: User) => {
      Object.values(scopes.value)
        .filter((scope) => scope.target === state.target)
        .forEach((scope) => {
          scope.sequence++;
          scope.loading = false;
          scope.softRefreshing = false;
          const item = scope.list.find((item) => item.id === user.id);
          if (item) Object.assign(item, user);
          const allowed = scope.roles?.split(',') ?? (scope.role ? [scope.role] : null);
          if (allowed && !allowed.includes(String(user.dialog_role)))
            scope.list = scope.list.filter((item) => item.id !== user.id);
        });
    };
    const syncMembership = async (
      target: string,
      response: { users_count?: number; message?: ChatMessage | null },
    ) => {
      const dialog = useDialogStore();
      if (
        dialog.current &&
        (dialog.current.dialog_id === target || dialog.current.username === target)
      ) {
        if (typeof response.users_count === 'number')
          dialog.current.users_count = response.users_count;
        if (response.message) await useMessagesStore().appendMessage(response.message);
      }
    };
    const updateRole = async (
      target: string,
      user: User,
      role: DialogMemberRole,
      permissions?: DialogPermission[],
    ) => {
      if (state.busyUserAction) return;
      const sequence = ++state.mutationSequence;
      state.busyUserAction = `${role}:${user.id}`;
      state.saving = true;
      state.mutationError = false;
      try {
        const response = await $http<{
          ok: boolean;
          role: DialogMemberRole;
          permissions: DialogPermission[];
        }>(`dialogs/${encodeURIComponent(target)}/users/${encodeURIComponent(user.id)}/role`, {
          method: 'PATCH',
          body: { role, ...(permissions === undefined ? {} : { permissions }) },
        });
        if (sequence !== state.mutationSequence) return;
        if (!response?.ok) throw new Error('Member role update failed');
        state.target = target;
        const updated = {
          ...user,
          dialog_role: response.role ?? role,
          dialog_permissions: response.permissions ?? [],
        };
        syncUser(updated);
        return updated;
      } catch (error) {
        if (sequence !== state.mutationSequence) return;
        state.mutationError = true;
        throw error;
      } finally {
        if (sequence === state.mutationSequence) {
          state.busyUserAction = null;
          state.saving = false;
        }
      }
    };
    const remove = async (target: string, user: User) => {
      if (state.busyUserAction) return;
      const sequence = ++state.mutationSequence;
      state.busyUserAction = `remove:${user.id}`;
      state.mutationError = false;
      try {
        const response = await $http<{
          removed: boolean;
          users_count: number;
          message?: ChatMessage | null;
        }>(`dialogs/${encodeURIComponent(target)}/users/${encodeURIComponent(user.id)}`, {
          method: 'DELETE',
        });
        if (sequence !== state.mutationSequence) return;
        if (response?.removed)
          Object.values(scopes.value)
            .filter((scope) => scope.target === target)
            .forEach((scope) => {
              // Invalidate pending pages so removed users cannot reappear from an older response.
              scope.sequence++;
              scope.loading = false;
              scope.softRefreshing = false;
              scope.list = scope.list.filter((item) => item.id !== user.id);
            });
        await syncMembership(target, response);
        return response;
      } catch (error) {
        if (sequence !== state.mutationSequence) return;
        state.mutationError = true;
        throw error;
      } finally {
        if (sequence === state.mutationSequence) state.busyUserAction = null;
      }
    };
    const add = async (target: string, users: string[]) => {
      if (state.saving) return;
      const sequence = ++state.mutationSequence;
      state.saving = true;
      state.mutationError = false;
      try {
        const response = await $http<{
          ok: boolean;
          added?: number;
          users_count?: number;
          message?: ChatMessage | null;
        }>(`dialogs/${encodeURIComponent(target)}/users`, { method: 'POST', body: { users } });
        if (sequence !== state.mutationSequence) return;
        if (!response?.ok) throw new Error('Member addition failed');
        await syncMembership(target, response);
        return response;
      } catch (error) {
        if (sequence !== state.mutationSequence) return;
        state.mutationError = true;
        throw error;
      } finally {
        if (sequence === state.mutationSequence) state.saving = false;
      }
    };
    return {
      state,
      fetchData,
      updateRole,
      remove,
      add,
      syncUser,
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
