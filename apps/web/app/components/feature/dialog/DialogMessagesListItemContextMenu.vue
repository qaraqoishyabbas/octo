<script setup lang="ts">
import type { ContextMenuItem } from '@nuxt/ui';
import type { ChatMessage } from '~/types';
import { copyToClipboard } from '~/utils/copy-to-clipboard';

const props = defineProps<{
  message: ChatMessage;
}>();

const route = useRoute();
const requestUrl = useRequestURL();
const toast = useToast();
const dialog = useDialogStore();
const messages = useMessagesStore();
const { confirm } = useConfirm();
const isContextMenuOpen = ref(false);
const permissions = useDialogPermissions();

const messageUrl = computed(() => {
  const url = new URL(route.fullPath, requestUrl.origin);
  url.searchParams.set('cursor_id', props.message.id);

  return url.toString();
});

const copyText = async (value: string, successTitle: string) => {
  if (!value) {
    return;
  }

  try {
    await copyToClipboard(value);
    toast.add({
      title: successTitle,
      color: 'success',
      icon: 'i-ph-check-circle-fill',
      progress: false,
      duration: 1600,
      close: false,
    });
  } catch {
    toast.add({
      title: 'Не удалось скопировать',
      color: 'error',
      icon: 'i-ph-warning-circle-fill',
      progress: false,
      duration: 2000,
      close: false,
    });
  }
};

const canDelete = computed(() => props.message.is_sender || permissions.canDeleteMessages.value);
const canEdit = computed(() => props.message.is_sender && Boolean(props.message.sender_id));
const canWriteMessage = computed(() => permissions.canSendMessages.value);
const canReply = computed(() => canWriteMessage.value && Boolean(props.message.id));
const canPin = computed(() => permissions.canPinMessages.value);
const canCopyMessageLink = computed(
  () => !['G', 'D'].includes(String(dialog.current?.type ?? '').toUpperCase()),
);
const isPinning = computed(() => messages.pinningMessageIds.includes(props.message.id));
const isEditing = computed(() => messages.editingMessageIds.includes(props.message.id));
const isDeleting = computed(() => messages.deletingMessageIds.includes(props.message.id));

const deleteMessage = async () => {
  const deleted = await messages.remove(props.message.id);

  toast.add({
    title: deleted ? 'Сообщение удалено' : 'Не удалось удалить сообщение',
    color: deleted ? 'success' : 'error',
    icon: deleted ? 'i-ph-check-circle-fill' : 'i-ph-warning-circle-fill',
    progress: false,
    duration: 1800,
    close: false,
  });
};

const confirmDeleteMessage = () => {
  confirm({
    title: 'Удалить сообщение?',
    description: 'Сообщение исчезнет из диалога для всех участников.',
    confirmButtonText: 'Удалить',
    confirmButtonColor: 'error',
    onConfirm: deleteMessage,
  });
};

const togglePinMessage = async () => {
  const updated = await messages.togglePin(props.message.id);

  toast.add({
    title: updated?.is_pinned ? 'Сообщение закреплено' : 'Сообщение откреплено',
    color: updated ? 'success' : 'error',
    icon: updated ? 'i-ph-check-circle-fill' : 'i-ph-warning-circle-fill',
    progress: false,
    duration: 1800,
    close: false,
  });
};

const items = computed<ContextMenuItem[][]>(() => [
  [
    ...(canReply.value
      ? [
          {
            label: 'Ответить',
            icon: 'i-ph-arrow-bend-up-left-bold',
            disabled: isDeleting.value,
            onSelect: () => messages.startReply(props.message),
          },
        ]
      : []),
    ...(canCopyMessageLink.value
      ? [
          {
            label: 'Копировать ссылку',
            icon: 'i-ph-link-bold',
            onSelect: () => copyText(messageUrl.value, 'Ссылка скопирована'),
          },
        ]
      : []),
    ...(canPin.value
      ? [
          {
            label: props.message.is_pinned ? 'Открепить' : 'Закрепить',
            icon: props.message.is_pinned ? 'i-ph-push-pin-slash-bold' : 'i-ph-push-pin-bold',
            loading: isPinning.value,
            disabled: isPinning.value || isDeleting.value,
            onSelect: togglePinMessage,
          },
        ]
      : []),
  ],
  ...(canEdit.value
    ? [
        [
          {
            label: 'Редактировать',
            icon: 'i-ph-pencil-simple-bold',
            loading: isEditing.value,
            disabled: isEditing.value,
            onSelect: () => messages.startEditing(props.message),
          },
        ],
      ]
    : []),
  ...(canDelete.value
    ? [
        [
          {
            label: 'Удалить',
            icon: 'i-ph-trash-bold',
            color: 'error' as const,
            loading: isDeleting.value,
            disabled: isDeleting.value,
            onSelect: confirmDeleteMessage,
          },
        ],
      ]
    : []),
]);
</script>

<template>
  <UContextMenu v-model:open="isContextMenuOpen" :items="items" size="xl">
    <slot />
  </UContextMenu>
</template>
