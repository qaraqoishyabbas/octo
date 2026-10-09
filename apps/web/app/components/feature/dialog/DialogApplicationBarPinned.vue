<script setup lang="ts">
import { DialogPinnedMessagesList } from '#components';

const dialog = useDialogStore();
const messages = useMessagesStore();
const overlay = useOverlay();
const latest = computed(() => messages.latestPinnedMessage);

const openPinnedMessages = () => {
  overlay.create(DialogPinnedMessagesList).open();
};

watch(
  () => [dialog.current?.dialog_id, dialog.current?.role],
  ([dialogId, role]) => {
    if (dialogId && role) void messages.fetchPinned();
  },
  { immediate: true },
);
</script>

<template>
  <div class="px-4 pb-2" v-if="latest && dialog.current?.role">
    <div class="bg-elevated flex rounded-md p-0.5 shadow-lg">
      <button
        class="hover:bg-accented/75 focus-visible:ring-primary w-full min-w-0 cursor-pointer rounded-md px-4 py-1 text-left focus-visible:ring-2 focus-visible:outline-none"
        type="button"
        aria-label="Открыть закреплённые сообщения"
        @click="openPinnedMessages"
      >
        <div class="flex items-center justify-between gap-1.5">
          <div class="min-w-0 flex-1">
            <div class="text-md line-clamp-1 truncate font-semibold">Закрепленное сообщение</div>
            <div class="text-muted truncate text-xs font-normal">
              <DialogsListItemText :message="latest.message" :attachments="latest.attachments" />
            </div>
          </div>
          <UIcon class="size-6 shrink-0" name="i-ph-list-star-bold" />
        </div>
      </button>
    </div>
  </div>
</template>
