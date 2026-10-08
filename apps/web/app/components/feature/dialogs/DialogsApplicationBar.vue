<script lang="ts" setup>
import { DialogsNewDialog } from '#components';

const overlay = useOverlay();
const dialogs = useDialogsStore();
const websocket = useWebSocketStore();
const emit = defineEmits<{ (e: 'title-click'): void }>();

const refreshDialogs = async () => {
  if (dialogs.loading) {
    return;
  }
  emit('title-click');
  await dialogs.fetchData();
};
</script>
<template>
  <AppBar>
    <template v-slot:center>
      <div class="animate-pulse" v-if="websocket.isConnecting">Подключение...</div>
      <div class="animate-pulse" v-else-if="dialogs.loading">Обновление...</div>
      <div class="w-full cursor-pointer" v-else @click="refreshDialogs">Главная</div>
    </template>
    <template v-slot:right>
      <UButton
        color="neutral"
        icon="i-ph-note-pencil-bold"
        size="xl"
        variant="soft"
        @click="overlay.create(DialogsNewDialog).open()"
      />
    </template>
    <template v-slot:bottom>
      <div class="px-4 pb-2.5">
        <div class="bg-elevated flex rounded-md">
          <DialogsApplicationBarTabs />
        </div>
      </div>
    </template>
  </AppBar>
</template>
