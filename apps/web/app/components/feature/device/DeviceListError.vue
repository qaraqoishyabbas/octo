<script setup lang="ts">
defineEmits<{ retry: [] }>();
</script>

<template>
  <div class="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-8">
    <span class="text-muted">Не удалось загрузить устройства</span>
    <UButton
      icon="i-ph-arrow-clockwise-bold"
      label="Повторить"
      variant="soft"
      @click="$emit('retry')"
    />
  </div>
</template>
