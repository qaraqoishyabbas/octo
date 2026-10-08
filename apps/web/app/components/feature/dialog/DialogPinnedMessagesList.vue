<script setup lang="ts">
const emit = defineEmits<{
  close: [value: boolean];
}>();

const messages = useMessagesStore();

const selectMessage = async (messageId: string) => {
  emit('close', false);
  await messages.loadAroundMessage(messageId, true);
};

onMounted(() => {
  void messages.fetchPinned();
});
</script>

<template>
  <USlideover
    side="right"
    title="Закрепленные сообщения"
    description="Список закрепленных сообщений"
  >
    <template v-slot:content>
      <AppBar>
        <template v-slot:left>
          <UButton
            icon="i-ph-caret-left-bold"
            size="xl"
            variant="ghost"
            color="neutral"
            @click="emit('close', false)"
          />
        </template>

        <template v-slot:center>Закрепленные сообщения</template>
      </AppBar>

      <DialogPinnedMessagesListLoading v-if="messages.pinnedLoading" />
      <DialogPinnedMessagesListError
        v-else-if="messages.pinnedError"
        @retry="messages.fetchPinned"
      />
      <DialogPinnedMessagesListEmpty v-else-if="messages.pinnedList.length === 0" />

      <div class="space-y-1 py-1" v-else>
        <div
          class="cursor-pointer"
          v-for="message in messages.pinnedList"
          :key="message.id"
          @click="selectMessage(message.id)"
        >
          <DialogMessagesListItem
            :message="message"
            context-menu="pinned"
            :media-interactive="false"
            :group-section-start="true"
            :group-section-end="true"
            :show-sender-name="true"
            @open="selectMessage(message.id)"
          />
        </div>
      </div>
    </template>
  </USlideover>
</template>
