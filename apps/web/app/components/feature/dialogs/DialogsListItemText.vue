<script setup lang="ts">
import type { MessageAttachment } from '~/types';

const props = defineProps<{
  message?: string;
  attachments?: MessageAttachment[];
}>();

const fallbackText = computed(() => {
  if (String(props.message ?? '').trim()) {
    return props.message;
  }

  const attachments = props.attachments ?? [];
  if (attachments.length === 0) {
    return '';
  }

  return attachments.some((file) => file.type === 'file') ? 'документ' : 'медиафайл';
});

const { renderedTextPreview } = useText(() => fallbackText.value);
</script>

<template>
  {{ renderedTextPreview }}
</template>
