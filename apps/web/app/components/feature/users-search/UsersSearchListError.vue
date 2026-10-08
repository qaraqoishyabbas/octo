<script setup lang="ts">
defineEmits<{ retry: [] }>();
</script>

<template>
  <div class="flex flex-col items-center gap-3 px-4 py-6">
    <span class="text-muted">Не удалось найти контакты</span>
    <UButton
      icon="i-ph-arrow-clockwise-bold"
      label="Повторить"
      variant="soft"
      @click="$emit('retry')"
    />
  </div>
</template>
