<script setup lang="ts">
const route = useRoute();
const dialog = useDialogStore();
const target = computed(() => route.params.target as string);
const scrollContainer = ref<HTMLElement | null>(null);

provide('dialogScrollContainer', scrollContainer);

watch(
  target,
  (value) => {
    if (value) {
      dialog.setCurrent(value);
    }
  },
  { immediate: true },
);
</script>

<template>
  <div
    class="bg-default fixed inset-0 z-100 overflow-y-auto overscroll-contain [overflow-anchor:none] [scrollbar-gutter:stable] lg:relative lg:flex-1"
    ref="scrollContainer"
  >
    <div class="relative mx-auto flex min-h-full w-full flex-1 flex-col lg:max-w-4xl">
      <DialogLoading v-if="dialog.loading" />
      <DialogError v-else-if="dialog.error" @retry="dialog.setCurrent(target)" />
      <DialogList v-else-if="dialog.current" />
      <DialogEmpty v-else />
    </div>
  </div>
</template>
