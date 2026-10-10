<script setup lang="ts">
const emit = defineEmits<{ close: [boolean] }>();
</script>

<template>
  <USlideover side="left" title="Основные" description="Основные настройки приложения">
    <template #content>
      <AppBar>
        <template #left>
          <UButton
            color="neutral"
            icon="i-ph-x-bold"
            size="xl"
            variant="soft"
            aria-label="Закрыть основные настройки"
            @click="emit('close', false)"
          />
        </template>
        <template #center>Основные</template>
      </AppBar>
      <div class="space-y-4 px-2.5 pb-4">
        <SettingDialog />
      </div>
    </template>
  </USlideover>
</template>
