<script setup lang="ts">
defineProps<{
  activeZone?: 'files' | 'media';
}>();
</script>

<template>
  <div class="pointer-events-none fixed inset-0 z-50 bg-black/35 p-4 backdrop-blur-sm">
    <div class="grid h-full grid-rows-2 gap-3">
      <div
        class="border-default bg-default/90 flex flex-col items-center justify-center rounded-lg border border-dashed text-center shadow-lg transition"
        :class="activeZone === 'files' ? 'border-primary bg-primary/10 text-primary' : 'text-muted'"
      >
        <UIcon class="mb-3 size-10" name="i-ph-file-arrow-up-bold" />
        <div class="text-base font-semibold">Документы и файлы</div>
        <div class="text-sm">Отпустите здесь, чтобы добавить как файл</div>
      </div>

      <div
        class="border-default bg-default/90 flex flex-col items-center justify-center rounded-lg border border-dashed text-center shadow-lg transition"
        :class="activeZone === 'media' ? 'border-primary bg-primary/10 text-primary' : 'text-muted'"
      >
        <UIcon class="mb-3 size-10" name="i-ph-image-square-bold" />
        <div class="text-base font-semibold">Фото и видео</div>
        <div class="text-sm">Отпустите здесь, чтобы открыть предпросмотр медиа</div>
      </div>
    </div>
  </div>
</template>
