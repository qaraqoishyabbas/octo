<script setup lang="ts">
defineEmits<{ retry: [] }>();
</script>

<template>
  <div class="flex h-full flex-1 flex-col items-center justify-center gap-3">
    <UBadge color="error" variant="soft" size="lg" label="Не удалось загрузить каналы" />
    <UButton
      color="neutral"
      variant="soft"
      icon="i-ph-arrow-clockwise-bold"
      label="Повторить"
      @click="$emit('retry')"
    />
  </div>
</template>
