<script setup lang="ts">
import { ProfileAdmins, ProfileAddUsers, ProfileEdit } from '#components';
import type { DropdownMenuItem } from '@nuxt/ui';
import type { Dialog } from '~/types';

const emit = defineEmits<{
  close: [boolean];
  openDialog: [];
  updated: [Dialog];
}>();

const props = defineProps<{
  profile?: Dialog | null;
  target?: string | null;
  canOpenDialog?: boolean;
}>();

const toast = useToast();
const overlay = useOverlay();
const { confirm } = useConfirm();
const dialogs = useDialogsStore();
const dialog = useDialogStore();
const { copyInviteLink, inviteLinkLoading } = useInviteLinkClipboard();
const menuOpen = ref(false);
const normalizedTarget = computed(() => String(props.target ?? '').trim());
const permissions = useDialogPermissions(() => props.profile);
const currentDialogType = computed(() => String(props.profile?.type ?? '').toUpperCase());
const currentMemberRole = computed(() => props.profile?.role ?? 'member');
const canManageGroupMembers = computed(
  () => currentDialogType.value === 'G' && permissions.canInviteUsers.value,
);
const canViewAdmins = computed(
  () => ['G', 'C'].includes(currentDialogType.value) && permissions.canManageAdmins.value,
);
const canEditProfile = computed(
  () => ['G', 'C'].includes(currentDialogType.value) && permissions.canManageDialog.value,
);
const canManageInviteLink = computed(
  () => ['G', 'C'].includes(currentDialogType.value) && permissions.canInviteUsers.value,
);
const canLeaveDialog = computed(
  () => ['G', 'C'].includes(currentDialogType.value) && currentMemberRole.value !== 'owner',
);

const openAdmins = () => {
  if (!normalizedTarget.value) return;

  overlay.create(ProfileAdmins).open({
    target: normalizedTarget.value,
    title: props.profile?.title,
    currentMemberRole: currentMemberRole.value,
    currentMemberPermissions: props.profile?.permissions ?? [],
    dialogType: props.profile?.type,
  });
};

const openAddUsers = () => {
  if (!normalizedTarget.value) return;

  overlay.create(ProfileAddUsers).open({
    target: normalizedTarget.value,
    title: props.profile?.title,
  });
};

const openEditProfile = () => {
  if (!normalizedTarget.value || !props.profile) return;

  overlay.create(ProfileEdit).open({
    profile: props.profile,
    target: normalizedTarget.value,
    onUpdated: (dialog: Dialog) => emit('updated', dialog),
  });
};

const leaveDialog = async () => {
  if (!props.profile?.dialog_id) return;

  try {
    await dialogs.leave(props.profile.dialog_id);
    toast.add({
      title: currentDialogType.value === 'C' ? 'Вы вышли из канала' : 'Вы вышли из группы',
      color: 'success',
      icon: 'i-ph-check-circle-fill',
      progress: false,
      duration: 2000,
      close: false,
    });
    dialog.$reset();
    emit('close', false);
    await navigateTo('/');
  } catch {
    toast.add({
      title: 'Не удалось выйти',
      color: 'error',
      icon: 'i-ph-warning-circle-fill',
      progress: false,
      duration: 2000,
      close: false,
    });
  }
};

const confirmLeaveDialog = () => {
  const isChannel = currentDialogType.value === 'C';

  confirm({
    title: isChannel ? 'Выйти из канала?' : 'Выйти из группы?',
    description: isChannel
      ? 'Вы потеряете доступ к этому каналу.'
      : 'Вы потеряете доступ к этой группе.',
    confirmButtonText: 'Выйти',
    confirmButtonColor: 'error',
    cancelButtonText: 'Отмена',
    onConfirm: leaveDialog,
  });
};

const menuItems = computed<DropdownMenuItem[][]>(() =>
  [
    [
      canManageGroupMembers.value
        ? {
            label: 'Добавить участников',
            icon: 'i-ph-user-plus-bold',
            onSelect: openAddUsers,
          }
        : null,
      canViewAdmins.value
        ? {
            label: 'Список администраторов',
            icon: 'i-ph-shield-check-bold',
            onSelect: openAdmins,
          }
        : null,
      canEditProfile.value
        ? {
            label: 'Редактировать',
            icon: 'i-ph-pencil-simple-bold',
            onSelect: openEditProfile,
          }
        : null,
      canManageInviteLink.value
        ? {
            label: 'Ссылка на приглашения',
            icon: 'i-ph-link-bold',
            loading: inviteLinkLoading.value,
            disabled: inviteLinkLoading.value,
            onSelect: () => copyInviteLink(normalizedTarget.value),
          }
        : null,
    ],
    [
      props.canOpenDialog && normalizedTarget.value
        ? {
            label: 'Перейти в диалог',
            icon: 'i-ph-chat-circle-dots-bold',
            onSelect: () => emit('openDialog'),
          }
        : null,
    ],
    [
      canLeaveDialog.value
        ? {
            label: currentDialogType.value === 'C' ? 'Выйти из канала' : 'Выйти из группы',
            icon: 'i-ph-sign-out-bold',
            color: 'error',
            onSelect: confirmLeaveDialog,
          }
        : null,
    ],
  ]
    .map((group) => group.filter(Boolean) as DropdownMenuItem[])
    .filter((group) => group.length > 0),
);
</script>

<template>
  <AppBar>
    <template v-slot:left>
      <UButton
        icon="i-ph-caret-left-bold"
        size="xl"
        variant="soft"
        color="neutral"
        @click="emit('close', false)"
      />
    </template>
    <template v-slot:right>
      <UDropdownMenu
        v-if="menuItems.length > 0"
        v-model:open="menuOpen"
        :items="menuItems"
        :content="{ align: 'end', side: 'bottom' }"
        :ui="{ content: 'w-64' }"
        size="xl"
      >
        <UButton icon="i-ph-list-bold" size="xl" variant="soft" color="neutral" />
      </UDropdownMenu>
    </template>
  </AppBar>
</template>
