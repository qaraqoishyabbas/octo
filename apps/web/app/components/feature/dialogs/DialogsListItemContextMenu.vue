<script setup lang="ts">
import type { ContextMenuItem } from '@nuxt/ui';
import type { Dialog } from '~/types';

const props = defineProps<{ item: Dialog }>();

const dialogs = useDialogsStore();
const requestUrl = useRequestURL();
const toast = useToast();
const isContextMenuOpen = ref(false);
const busyAction = ref<string | null>(null);
const isBusy = computed(() => busyAction.value !== null);
const linkTarget = computed(() => props.item.username || props.item.dialog_id);
const dialogUrl = computed(() => `${requestUrl.origin}/@${linkTarget.value}`);

const openInNewTab = () => {
  window.open(dialogUrl.value, '_blank', 'popup=yes,width=800,height=800,noopener,noreferrer');
};

const runAction = async (key: string, action: () => Promise<unknown>) => {
  if (isBusy.value) return;

  busyAction.value = key;
  try {
    await action();
  } finally {
    busyAction.value = null;
  }
};

const items = computed<ContextMenuItem[][]>(() => [
  [
    {
      label: 'Открыть в новой вкладке',
      icon: 'i-ph-browsers-bold',
      disabled: isBusy.value,
      onSelect: openInNewTab,
    },
  ],
  [
    {
      label: props.item.pinned ? 'Открепить' : 'Закрепить',
      icon: props.item.pinned ? 'i-ph-push-pin-slash-bold' : 'i-ph-push-pin-bold',
      loading: busyAction.value === 'pin',
      disabled: isBusy.value,
      onSelect: () => runAction('pin', () => dialogs.pin(props.item.dialog_id)),
    },
    {
      label: props.item.muted ? 'Включить уведомления' : 'Выключить уведомления',
      icon: props.item.muted ? 'i-ph-bell-bold' : 'i-ph-bell-slash-bold',
      loading: busyAction.value === 'mute',
      disabled: isBusy.value,
      onSelect: () => runAction('mute', () => dialogs.mute(props.item.dialog_id)),
    },
    {
      label: props.item.archived ? 'Вернуть из архива' : 'В архив',
      icon: props.item.archived ? 'i-ph-archive-tray-bold' : 'i-ph-archive-bold',
      loading: busyAction.value === 'archive',
      disabled: isBusy.value,
      onSelect: () => runAction('archive', () => dialogs.archive(props.item.dialog_id)),
    },
    ...((props.item.counter ?? 0) > 0
      ? [
          {
            label: 'Пометить прочитанным',
            icon: 'i-ph-checks-bold',
            loading: busyAction.value === 'read',
            disabled: isBusy.value,
            onSelect: () => runAction('read', () => dialogs.readAll(props.item.dialog_id)),
          },
        ]
      : []),
  ],
]);
</script>

<template>
  <UContextMenu v-model:open="isContextMenuOpen" :items="items" size="xl">
    <slot />
  </UContextMenu>
</template>
