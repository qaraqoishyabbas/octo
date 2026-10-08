<script setup lang="ts">
import type { MessageAttachment } from '~/types';

const props = withDefaults(
  defineProps<{
    title: string;
    message?: string | null;
    attachments?: MessageAttachment[];
    closeable?: boolean;
    icon?: string | null;
    clickable?: boolean;
  }>(),
  {
    message: '',
    closeable: true,
    icon: 'i-ph-pencil-simple-line-bold',
    clickable: false,
  },
);

const emit = defineEmits<{
  close: [];
  open: [];
}>();

const open = () => {
  if (props.clickable) {
    emit('open');
  }
};
</script>

<template>
  <div class="flex items-center gap-2 pl-2">
    <div
      class="border-primary bg-primary/10 flex min-w-0 flex-1 flex-col rounded-xs border-l-2 px-3"
      :class="{ 'hover:bg-primary/15 cursor-pointer': clickable }"
      :role="clickable ? 'button' : undefined"
      :tabindex="clickable ? 0 : undefined"
      @click="open"
      @keydown.enter.prevent="open"
      @keydown.space.prevent="open"
    >
      <div class="text-primary text-sm font-medium">{{ title }}</div>
      <DialogMessagesListItemText
        class="line-clamp-1"
        :message="props.message || ''"
        :attachments="props.attachments"
      />
    </div>
    <UButton
      v-if="closeable"
      type="button"
      size="xl"
      color="neutral"
      variant="soft"
      icon="i-ph-x-bold"
      @click="emit('close')"
    />
  </div>
</template>
