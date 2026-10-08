<script setup lang="ts">
defineEmits<{ retry: [] }>();
</script>

<template>
  <div class="flex min-h-32 flex-col items-center justify-center gap-3">
    <div class="text-muted text-center text-sm">Не удалось загрузить закрепленные сообщения</div>
    <UButton
      color="neutral"
      variant="soft"
      icon="i-ph-arrow-clockwise-bold"
      label="Повторить"
      @click="$emit('retry')"
    />
  </div>
</template>
