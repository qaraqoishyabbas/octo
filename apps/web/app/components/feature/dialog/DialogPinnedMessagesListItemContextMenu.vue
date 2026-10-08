<script setup lang="ts">
import type { ContextMenuItem } from '@nuxt/ui';
import type { ChatMessage } from '~/types';
import { copyToClipboard } from '~/utils/copy-to-clipboard';

const props = defineProps<{
  message: ChatMessage;
}>();

const emit = defineEmits<{
  open: [];
}>();

const route = useRoute();
const requestUrl = useRequestURL();
const toast = useToast();
const dialog = useDialogStore();
const messages = useMessagesStore();
const isContextMenuOpen = ref(false);
const permissions = useDialogPermissions();

const messageUrl = computed(() => {
  const url = new URL(route.fullPath, requestUrl.origin);
  url.searchParams.set('cursor_id', props.message.id);

  return url.toString();
});

const isPinning = computed(() => messages.pinningMessageIds.includes(props.message.id));
const canPin = computed(() => permissions.canPinMessages.value);
const canCopyMessageLink = computed(
  () => !['G', 'D'].includes(String(dialog.current?.type ?? '').toUpperCase()),
);

const copyLink = async () => {
  try {
    await copyToClipboard(messageUrl.value);
    toast.add({
      title: 'Ссылка скопирована',
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

const unpinMessage = async () => {
  const updated = await messages.togglePin(props.message.id);

  toast.add({
    title:
      updated && !updated.is_pinned ? 'Сообщение откреплено' : 'Не удалось открепить сообщение',
    color: updated && !updated.is_pinned ? 'success' : 'error',
    icon: updated && !updated.is_pinned ? 'i-ph-check-circle-fill' : 'i-ph-warning-circle-fill',
    progress: false,
    duration: 1800,
    close: false,
  });
};

const items = computed<ContextMenuItem[][]>(() => [
  [
    {
      label: 'Перейти к сообщению',
      icon: 'i-ph-arrow-square-out-bold',
      onSelect: () => emit('open'),
    },
    ...(canCopyMessageLink.value
      ? [
          {
            label: 'Копировать ссылку',
            icon: 'i-ph-link-bold',
            onSelect: copyLink,
          },
        ]
      : []),
  ],
  ...(canPin.value
    ? [
        [
          {
            label: 'Открепить',
            icon: 'i-ph-push-pin-slash-bold',
            loading: isPinning.value,
            disabled: isPinning.value,
            onSelect: unpinMessage,
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
