import type { MaybeRefOrGetter } from 'vue';
import type { Dialog, DialogPermission } from '~/types';

export const useDialogPermissions = (source?: MaybeRefOrGetter<Dialog | null | undefined>) => {
  const dialog = source
    ? computed(() => toValue(source))
    : computed(() => useDialogStore().current);

  const has = (permission: DialogPermission) =>
    Boolean(dialog.value?.permissions?.includes(permission));
  const hasAny = (permissions: DialogPermission[]) => permissions.some(has);

  return {
    has,
    hasAny,
    canSendMessages: computed(() => has('send_messages')),
    canPinMessages: computed(() => has('pin_messages')),
    canDeleteMessages: computed(() => has('delete_messages')),
    canBanUsers: computed(() => has('ban_users')),
    canManageDialog: computed(() => has('manage_dialog')),
    canInviteUsers: computed(() => has('invite_users')),
    canManageAdmins: computed(() => has('manage_admins')),
  };
};
