<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui';
import { Profile } from '#components';

const dialog = useDialogStore();
const dialogs = useDialogsStore();
const overlay = useOverlay();
const toast = useToast();
const { confirm } = useConfirm();
const open = ref(false);
const busyAction = ref<string | null>(null);
const { withCount } = useInflection();
const usersOnline = useUsersOnlineStore();
const dialogTyping = useDialogTypingStore();
const isBusy = computed(() => busyAction.value !== null);
const current = computed(() => dialog.current);
const currentDialogType = computed(() => String(current.value?.type ?? '').toUpperCase());
const isDialogMember = computed(() => Boolean(current.value?.role));
const canLeaveDialog = computed(
  () =>
    isDialogMember.value &&
    ['G', 'C'].includes(String(current.value?.type ?? '').toUpperCase()) &&
    current.value?.role !== 'owner',
);
const usernameText = (username?: string | null) => (username ? `@${username}` : 'был(-а) давно');
const openProfile = () => {
  overlay.create(Profile).open();
};
const runAction = async (key: string, action: () => Promise<void> | void) => {
  if (isBusy.value || !current.value?.dialog_id) return;

  busyAction.value = key;
  try {
    await action();
  } finally {
    busyAction.value = null;
  }
};
const toggleMute = async () => {
  if (!current.value?.dialog_id) return;

  const response = await dialogs.mute(current.value.dialog_id);

  if (typeof response?.muted === 'boolean') {
    current.value.muted = response.muted;
  }
};
const leaveDialog = async () => {
  if (!current.value?.dialog_id) return;

  await dialogs.leave(current.value.dialog_id);
  toast.add({
    title: current.value.type === 'C' ? 'Вы вышли из канала' : 'Вы вышли из группы',
    color: 'success',
    icon: 'i-ph-check-circle-fill',
    progress: false,
    duration: 2000,
    close: false,
  });
  dialog.$reset();
  await navigateTo('/');
};
const confirmLeaveDialog = () => {
  const isChannel = current.value?.type === 'C';

  confirm({
    title: isChannel ? 'Покинуть канал?' : 'Удалить группу из списка и выйти?',
    description: isChannel
      ? 'Вы потеряете доступ к этому каналу.'
      : 'Вы потеряете доступ к этой группе.',
    confirmButtonText: isChannel ? 'Покинуть канал' : 'Удалить и выйти',
    confirmButtonColor: 'error',
    cancelButtonText: 'Отмена',
    onConfirm: () => runAction('leave', leaveDialog),
  });
};
const dialogAudienceText = computed(() => {
  if (dialog.current?.is_self) {
    return '';
  }

  const typingText = dialogTyping.getAudienceText(dialog.current);
  if (typingText) {
    return typingText;
  }

  const type = String(dialog.current?.type ?? '').toUpperCase();
  const count = Number(dialog.current?.users_count ?? 0);
  if (type === 'G') {
    return withCount(count, ['участник', 'участника', 'участников']);
  }
  if (type === 'C') {
    return withCount(count, ['подписчик', 'подписчика', 'подписчиков']);
  }
  if (type === 'D' && dialog.current?.author_id) {
    return usersOnline.getOnlineText(
      dialog.current.author_id,
      usernameText(dialog.current.username),
    );
  }
  return '';
});
const dialogAudienceIsPrimary = computed(() => {
  if (dialogTyping.getAudienceText(dialog.current)) {
    return true;
  }

  return (
    String(dialog.current?.type ?? '').toUpperCase() === 'D' &&
    usersOnline.isOnline(dialog.current?.author_id)
  );
});
const items = computed<DropdownMenuItem[][]>(() => {
  const actionItems: DropdownMenuItem[] = isDialogMember.value
    ? [
        {
          label: current.value?.muted ? 'Включить уведомления' : 'Выключить уведомления',
          icon: current.value?.muted ? 'i-ph-bell-bold' : 'i-ph-bell-slash-bold',
          loading: busyAction.value === 'mute',
          disabled: isBusy.value,
          onSelect: () => runAction('mute', toggleMute),
        },
      ]
    : [];

  if (canLeaveDialog.value) {
    actionItems.push({
      label: currentDialogType.value === 'C' ? 'Покинуть канал' : 'Удалить и выйти',
      icon: 'i-ph-sign-out-bold',
      color: 'error',
      loading: busyAction.value === 'leave',
      disabled: isBusy.value,
      onSelect: confirmLeaveDialog,
    });
  }

  return [
    [
      {
        label: 'Информация',
        icon: 'i-ph-info-bold',
        disabled: isBusy.value,
        onSelect: openProfile,
      },
    ],
    actionItems,
  ].filter((group) => group.length > 0);
});
</script>

<template>
  <div class="sticky top-0 right-0 left-0 z-20" data-dialog-application-bar>
    <div class="via-default/80 from-default bg-gradient-to-b to-transparent">
      <div class="flex gap-1.5 px-4 py-2">
        <div class="bg-elevated flex rounded-md p-0.5 shadow-lg">
          <UButton color="neutral" icon="i-ph-caret-left-bold" size="xl" variant="soft" to="/" />
        </div>
        <div class="bg-elevated flex w-full rounded-md p-0.5 shadow-lg">
          <div
            class="hover:bg-accented/75 flex w-full cursor-pointer gap-2 rounded-md"
            @click="openProfile"
          >
            <UAvatar
              class="cursor-pointer shadow-lg"
              size="xl"
              :alt="dialog.current?.title"
              :src="$storage(dialog.current?.avatar)"
            />
            <div>
              <div class="text-md line-clamp-1 space-x-0.5 font-semibold">
                <span class="truncate wrap-anywhere whitespace-pre-line">
                  {{ dialog.current?.title }}
                </span>
              </div>

              <div class="text-muted line-clamp-1 truncate text-xs font-normal">
                <span :class="{ 'text-primary': dialogAudienceIsPrimary }">
                  {{ dialogAudienceText }}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div class="bg-elevated flex rounded-md p-0.5 shadow-lg">
          <UButton
            v-if="currentDialogType !== 'C'"
            color="neutral"
            icon="i-ph-magnifying-glass-bold"
            size="xl"
            variant="soft"
            aria-label="Поиск по сообщениям"
            @click="dialog.openSearch()"
          />
          <UDropdownMenu
            v-model:open="open"
            :items="items"
            :content="{ align: 'end', side: 'bottom' }"
            :ui="{ content: 'w-64' }"
            size="xl"
          >
            <UButton
              color="neutral"
              icon="i-ph-dots-three-bold"
              size="xl"
              variant="soft"
              aria-label="Меню диалога"
            />
          </UDropdownMenu>
        </div>
      </div>
      <DialogApplicationBarSearch v-model="dialog.searchOpen" />
      <DialogApplicationBarPinned v-if="!dialog.searchOpen" />
    </div>
  </div>
</template>
