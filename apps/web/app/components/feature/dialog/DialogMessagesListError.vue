<script setup lang="ts">
const emit = defineEmits<{
  retry: [];
}>();
</script>

<template>
  <div class="absolute inset-0 flex flex-col items-center justify-center gap-3">
    <UBadge color="error" variant="soft" label="Не удалось загрузить сообщения" />
    <UButton
      color="neutral"
      variant="soft"
      icon="i-ph-arrow-clockwise-bold"
      label="Повторить"
      @click="emit('retry')"
    />
  </div>
</template>
