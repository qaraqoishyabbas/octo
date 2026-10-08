<script setup lang="ts">
withDefaults(defineProps<{ label?: string; compact?: boolean; padded?: boolean }>(), {
  label: 'Пока пусто',
});
</script>

<template>
  <div
    :class="[
      compact ? 'text-center' : 'flex h-full w-full items-center justify-center',
      { 'p-4': padded },
    ]"
  >
    <UBadge color="neutral" variant="soft" size="lg" :label="label" />
  </div>
</template>
