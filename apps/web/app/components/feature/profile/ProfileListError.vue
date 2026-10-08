<script setup lang="ts">
withDefaults(
  defineProps<{ label: string; badge?: boolean; compact?: boolean; padded?: boolean }>(),
  { badge: true },
);
const emit = defineEmits<{ retry: [] }>();
</script>

<template>
  <div
    :class="[
      compact ? 'text-center' : 'flex h-full flex-col items-center justify-center gap-2',
      { 'p-4': padded },
    ]"
  >
    <UBadge v-if="badge" color="error" variant="soft" size="lg" :label="label" />
    <div class="text-muted text-sm" v-else>{{ label }}</div>
    <div :class="{ 'pt-2': compact }">
      <UButton
        color="neutral"
        variant="soft"
        label="Повторить"
        :size="badge ? undefined : 'sm'"
        @click="emit('retry')"
      />
    </div>
  </div>
</template>
