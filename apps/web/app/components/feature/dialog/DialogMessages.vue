<script setup lang="ts">
const messages = useMessagesStore();
const dialog = useDialogStore();
const route = useRoute();

const routeMessageId = computed(() => {
  const value = route.query.cursor_id;
  return Array.isArray(value) ? value[0] : value;
});

watch(
  () => [dialog.current?.dialog_id, routeMessageId.value],
  ([dialogId, messageId]) => {
    if (!dialogId) {
      return;
    }

    if (messageId) {
      void messages.loadAroundMessage(messageId, true);
      return;
    }

    void messages.loadInitial();
  },
  { immediate: true },
);
</script>

<template>
  <div class="relative flex w-full flex-1 flex-col">
    <DialogMessagesListLoading v-if="messages.loading" />
    <DialogMessagesListError v-else-if="messages.error" @retry="messages.retryInitial" />
    <div class="mt-auto" v-else-if="messages.list.length > 0">
      <DialogMessagesList />
    </div>
    <DialogMessagesListEmpty v-else />
  </div>
</template>
