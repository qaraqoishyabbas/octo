<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui';

const props = defineProps<{
  disabled?: boolean;
}>();

const emit = defineEmits<{
  select: [files: FileList, type: 'media' | 'file'];
}>();

const mediaInput = ref<HTMLInputElement | null>(null);
const documentInput = ref<HTMLInputElement | null>(null);
const mediaInputAccept =
  'image/*,video/*,.jpg,.jpeg,.png,.gif,.webp,.avif,.heic,.heif,.mp4,.m4v,.mov,.webm,.mkv,.avi,.mpeg,.mpg,.3gp,.3g2,.JPG,.JPEG,.PNG,.GIF,.WEBP,.AVIF,.HEIC,.HEIF,.MP4,.M4V,.MOV,.WEBM,.MKV,.AVI,.MPEG,.MPG,.3GP,.3G2';

const openMediaPicker = () => {
  if (!props.disabled) {
    mediaInput.value?.click();
  }
};

const openDocumentPicker = () => {
  if (!props.disabled) {
    documentInput.value?.click();
  }
};

const onFileSelect = (event: Event, type: 'media' | 'file') => {
  const input = event.target as HTMLInputElement | null;

  if (!input?.files?.length) {
    return;
  }

  emit('select', input.files, type);
  input.value = '';
};

const items = computed<DropdownMenuItem[][]>(() => [
  [
    {
      label: 'Фото и Видео',
      icon: 'i-ph-image-square-bold',
      disabled: props.disabled,
      onSelect: openMediaPicker,
    },
    {
      label: 'Документы',
      icon: 'i-ph-file-bold',
      disabled: props.disabled,
      onSelect: openDocumentPicker,
    },
  ],
]);
</script>

<template>
  <div>
    <input
      class="hidden"
      ref="mediaInput"
      type="file"
      multiple
      :accept="mediaInputAccept"
      @change="onFileSelect($event, 'media')"
    />
    <input
      class="hidden"
      ref="documentInput"
      type="file"
      multiple
      @change="onFileSelect($event, 'file')"
    />
    <UDropdownMenu
      :items="items"
      size="xl"
      :content="{ align: 'start', side: 'top', sideOffset: 12 }"
    >
      <UButton
        type="button"
        size="xl"
        color="neutral"
        variant="ghost"
        icon="i-ph-paperclip-bold"
        :disabled="props.disabled"
      />
    </UDropdownMenu>
  </div>
</template>
