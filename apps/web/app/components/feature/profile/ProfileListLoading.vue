<script setup lang="ts">
defineProps<{ more?: boolean }>();
</script>

<template>
  <div
    :class="
      more ? 'flex items-center justify-center py-4' : 'flex h-full items-center justify-center'
    "
  >
    <UIcon class="text-muted size-6 animate-spin" name="i-ph-circle-notch-bold" />
  </div>
</template>
