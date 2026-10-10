<script setup lang="ts">
import type { MessageAttachment } from '~/types';

const props = defineProps<{
  files?: MessageAttachment[];
  own?: boolean;
}>();

const vMediaPrefetch = useMediaFilePrefetch();

const { downloadingKey, downloadMessageFile } = useFileDownload();

const documentFiles = computed(() => (props.files ?? []).filter((file) => file.type === 'file'));

const formatSize = (size: number) => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};

const isDownloading = (file: MessageAttachment) => downloadingKey.value === file.id;
</script>

<template>
  <div class="space-y-1" v-if="documentFiles.length">
    <Item
      class="group bg-transparent"
      v-for="file in documentFiles"
      v-media-prefetch="file"
      :key="file.id"
      :class="props.own ? 'hover:bg-primary/10' : 'hover:bg-neutral-500/10'"
      @click="downloadMessageFile(file)"
    >
      <template v-slot:avatar>
        <UAvatar
          class="animate-spin"
          v-if="isDownloading(file)"
          size="3xl"
          icon="i-ph-circle-notch-bold"
        />
        <div class="relative" v-else>
          <UAvatar
            class="transition-opacity group-hover:opacity-0"
            size="3xl"
            icon="i-ph-file-bold"
          />
          <UAvatar
            class="absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100"
            size="3xl"
            icon="i-ph-arrow-fat-down-bold"
          />
        </div>
      </template>
      <template v-slot:heading>
        {{ file.original_name }}
      </template>
      <template v-slot:description>
        {{ formatSize(file.size) }}
        <!--        <UButton variant="link">Скачать</UButton>-->
      </template>
    </Item>
  </div>
</template>
