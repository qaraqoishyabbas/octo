<script setup lang="ts">
import { ProfileAddUsers, ProfileEdit } from '#components';
import type { DropdownMenuItem } from '@nuxt/ui';
import type { Dialog } from '~/types';

const props = defineProps<{
  profile: Dialog;
  target?: string | null;
  canOpenDialog?: boolean;
  canSearch?: boolean;
}>();

const emit = defineEmits<{
  openDialog: [];
  openSearch: [];
  updated: [Dialog];
}>();

const toast = useToast();
const overlay = useOverlay();
const dialogs = useDialogsStore();
const dialog = useDialogStore();
const { copyInviteLink, inviteLinkLoading } = useInviteLinkClipboard();

const normalizedTarget = computed(() =>
  String(props.target || props.profile.username || props.profile.dialog_id || '').trim(),
);
const permissions = useDialogPermissions(() => props.profile);
const dialogType = computed(() => String(props.profile.type ?? '').toUpperCase());
const canAddUsers = computed(() => dialogType.value === 'G' && permissions.canInviteUsers.value);
const canInvite = computed(
  () => ['G', 'C'].includes(dialogType.value) && permissions.canInviteUsers.value,
);
const canEdit = computed(
  () => ['G', 'C'].includes(dialogType.value) && permissions.canManageDialog.value,
);
const canToggleNotifications = computed(
  () => Boolean(props.profile.role) && !props.profile.is_self,
);
const isMuted = computed(() => Boolean(props.profile.muted));
const notificationLabel = computed(() => (isMuted.value ? 'Звук' : 'Без звука'));
const notificationIcon = computed(() =>
  isMuted.value ? 'i-ph-bell-bold' : 'i-ph-bell-slash-bold',
);
const openDialogLabel = computed(() => (dialogType.value === 'D' ? 'Чат' : 'Чат'));

const syncUpdatedDialog = (updatedDialog: Dialog) => {
  emit('updated', updatedDialog);

  if (dialog.current?.dialog_id === updatedDialog.dialog_id) {
    dialog.current = updatedDialog;
  }
};

const toggleNotifications = async () => {
  if (!props.profile.dialog_id) {
    return;
  }

  try {
    const response = await dialogs.mute(props.profile.dialog_id);
    if (typeof response?.muted !== 'boolean') {
      return;
    }

    syncUpdatedDialog({
      ...props.profile,
      muted: response.muted,
    });
  } catch {
    toast.add({
      title: 'Не удалось изменить уведомления',
      color: 'error',
      icon: 'i-ph-warning-circle-fill',
      progress: false,
      duration: 2000,
      close: false,
    });
  }
};

const openAddUsers = () => {
  if (!normalizedTarget.value) return;

  overlay.create(ProfileAddUsers).open({
    target: normalizedTarget.value,
    title: props.profile.title,
  });
};

const openEditProfile = () => {
  if (!normalizedTarget.value) return;

  overlay.create(ProfileEdit).open({
    profile: props.profile,
    target: normalizedTarget.value,
    onUpdated: syncUpdatedDialog,
  });
};

type QuickAction = {
  key: string;
  label: string;
  icon: string;
  color?: 'neutral' | 'primary';
  disabled?: boolean;
  action: () => void | Promise<void>;
};

const actions = computed<QuickAction[]>(
  () =>
    [
      props.canOpenDialog
        ? {
            key: 'open',
            label: openDialogLabel.value,
            icon: 'i-ph-chat-circle-dots-bold',
            color: 'primary' as const,
            action: () => emit('openDialog'),
          }
        : null,
      props.canSearch
        ? {
            key: 'search',
            label: 'Поиск',
            icon: 'i-ph-magnifying-glass-bold',
            color: 'primary' as const,
            action: () => emit('openSearch'),
          }
        : null,
      canToggleNotifications.value
        ? {
            key: 'notifications',
            label: notificationLabel.value,
            icon: notificationIcon.value,
            action: toggleNotifications,
          }
        : null,
      canAddUsers.value
        ? {
            key: 'add-users',
            label: 'Добавить',
            icon: 'i-ph-user-plus-bold',
            action: openAddUsers,
          }
        : null,
      canInvite.value
        ? {
            key: 'invite',
            label: 'Ссылка',
            icon: 'i-ph-link-bold',
            disabled: inviteLinkLoading.value,
            action: () => copyInviteLink(normalizedTarget.value),
          }
        : null,
      canEdit.value
        ? {
            key: 'edit',
            label: 'Изменить',
            icon: 'i-ph-pencil-simple-bold',
            action: openEditProfile,
          }
        : null,
    ].filter(Boolean) as QuickAction[],
);

const visibleActions = computed(() =>
  actions.value.length > 3 ? actions.value.slice(0, 2) : actions.value,
);
const overflowActions = computed(() => (actions.value.length > 3 ? actions.value.slice(2) : []));
const actionColumns = computed(
  () => visibleActions.value.length + (overflowActions.value.length > 0 ? 1 : 0),
);
const overflowMenuItems = computed<DropdownMenuItem[][]>(() => [
  overflowActions.value.map((action) => ({
    label: action.label,
    icon: action.icon,
    disabled: action.disabled,
    onSelect: action.action,
  })),
]);
</script>

<template>
  <div class="px-4 pb-4" v-if="actions.length > 0">
    <div
      class="grid gap-2"
      :style="{ gridTemplateColumns: `repeat(${actionColumns}, minmax(0, 1fr))` }"
    >
      <UButton
        class="text-primary flex min-h-16 flex-col items-center justify-center gap-1 rounded-md px-2 py-2 text-center transition-colors"
        v-for="action in visibleActions"
        :key="action.key"
        color="neutral"
        variant="soft"
        block
        :disabled="action.disabled"
        @click="action.action"
      >
        <UIcon class="size-6" :name="action.icon" />
        <span class="max-w-full truncate text-xs font-medium">{{ action.label }}</span>
      </UButton>
      <UDropdownMenu
        v-if="overflowActions.length > 0"
        :items="overflowMenuItems"
        :content="{ align: 'end', side: 'bottom' }"
        :ui="{ content: 'w-56' }"
      >
        <UButton
          class="text-primary flex min-h-16 flex-col items-center justify-center gap-1 rounded-md px-2 py-2 text-center transition-colors"
          color="neutral"
          variant="soft"
          block
        >
          <UIcon class="size-6" name="i-ph-dots-three-bold" />
          <span class="max-w-full truncate text-xs font-medium">Ещё</span>
        </UButton>
      </UDropdownMenu>
    </div>
  </div>
</template>
