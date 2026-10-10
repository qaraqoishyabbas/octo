<script setup lang="ts">
const folders = useChatFoldersStore();
const emit = defineEmits<{ close: [boolean] }>();
</script>

<template>
  <USlideover side="left" title="Папки с чатами" description="Выберите папки для главного экрана">
    <template #content>
      <AppBar>
        <template #left>
          <UButton
            color="neutral"
            icon="i-ph-x-bold"
            size="xl"
            variant="soft"
            aria-label="Закрыть настройки папок"
            @click="emit('close', false)"
          />
        </template>
        <template #center>Папки с чатами</template>
      </AppBar>
      <div class="space-y-4 px-2.5 pb-4">
        <p class="text-muted px-3">Выберите папки, которые будут отображаться над списком чатов.</p>
        <div class="bg-elevated space-y-1 rounded-md p-3">
          <USwitch
            class="w-full py-2"
            v-for="folder in folders.folderOptions"
            :key="folder.value"
            :label="folder.label"
            :model-value="folders.visibleFilters.some((item) => item.value === folder.value)"
            size="xl"
            @update:model-value="folders.setFolder(folder.value, $event)"
          />
        </div>
      </div>
    </template>
  </USlideover>
</template>
