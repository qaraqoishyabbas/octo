<script lang="ts">
export type UploadPreview = {
  localId: string;
  name: string;
  type: string;
  size: number;
  sourceFile?: File;
  id?: string;
  path?: string;
  thumbnail_path?: string | null;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
  uploading: boolean;
  progress: number;
  abortController?: AbortController;
  error?: string;
};
</script>

<script setup lang="ts">
import type { MessageAttachment } from '~/types';
import {
  calculateAlbumLayout,
  calculateMessageMediaDimensions,
  type MediaLayout,
} from '~/utils/messageMediaLayout';

const props = defineProps<{
  media: UploadPreview[];
  files: UploadPreview[];
  loading: boolean;
}>();
const emit = defineEmits<{
  retry: [preview: UploadPreview];
  cancel: [preview: UploadPreview];
  remove: [preview: UploadPreview];
}>();

const mediaContainerRef = ref<HTMLElement | null>(null);
const mediaContainerWidth = ref(0);
const loaded = ref<Record<string, boolean>>({});
const failed = ref<Record<string, boolean>>({});
const isViewerOpen = ref(false);
const selectedMediaIndex = ref(0);
let mediaResizeObserver: ResizeObserver | null = null;
const isReadyPreview = (file: UploadPreview) =>
  Boolean(file.id && file.path && !file.uploading && !file.error);

const mediaPreviews = computed(() => props.media);
const filePreviews = computed(() => props.files);
const isAlbum = computed(() => mediaPreviews.value.length > 1);
const mediaAttachments = computed(() => mediaPreviews.value.map(previewToAttachment));
const readyMediaAttachments = computed(() =>
  mediaPreviews.value.filter(isReadyPreview).map((file) => previewToAttachment(file)),
);
const albumLayout = computed(() =>
  isAlbum.value ? calculateAlbumLayout(mediaAttachments.value) : null,
);
const singleDimensions = computed(() =>
  mediaAttachments.value[0] ? calculateMessageMediaDimensions(mediaAttachments.value[0]) : null,
);
const singleScale = computed(() => {
  if (!singleDimensions.value?.width || mediaContainerWidth.value <= 0) {
    return 1;
  }

  return mediaContainerWidth.value / singleDimensions.value.width;
});
const albumScale = computed(() => {
  if (!albumLayout.value?.containerStyle.width || mediaContainerWidth.value <= 0) {
    return 1;
  }

  return mediaContainerWidth.value / albumLayout.value.containerStyle.width;
});
const mediaContainerStyle = computed(() => {
  if (isAlbum.value) {
    if (!albumLayout.value) return undefined;

    return {
      width: '100%',
      height: `${Math.round(albumLayout.value.containerStyle.height * albumScale.value)}px`,
    };
  }

  if (!singleDimensions.value) return undefined;

  return {
    width: '100%',
    height: `${Math.round(singleDimensions.value.height * singleScale.value)}px`,
  };
});
const mediaItemEntries = computed(() =>
  mediaPreviews.value.map((file, index) => ({
    file,
    style: mediaItemStyle(index),
  })),
);
const skeletonClass = 'absolute inset-0 animate-pulse rounded-xs bg-neutral-200 dark:bg-elevated';

const keyOf = (file: UploadPreview) => file.localId;

function previewToAttachment(file: UploadPreview): MessageAttachment {
  return {
    id: file.localId,
    type: 'media',
    mime_type: file.type,
    original_name: file.name,
    path: file.path || '',
    size: file.size,
    width: file.width,
    height: file.height,
    duration: file.duration,
    thumbnail_path: file.thumbnail_path,
  };
}

function scaledLayoutStyle(layout: MediaLayout) {
  const { x, y, width, height } = layout.dimensions;
  const scale = albumScale.value;

  return {
    left: `${Math.round(x * scale)}px`,
    top: `${Math.round(y * scale)}px`,
    width: `${Math.round(width * scale)}px`,
    height: `${Math.round(height * scale)}px`,
  };
}

function mediaItemStyle(index: number) {
  if (isAlbum.value && albumLayout.value?.layout[index]) {
    return scaledLayoutStyle(albumLayout.value.layout[index]);
  }

  if (!singleDimensions.value) return undefined;

  return {
    left: '0px',
    top: '0px',
    width: '100%',
    height: `${Math.round(singleDimensions.value.height * singleScale.value)}px`,
  };
}

const updateMediaContainerWidth = () => {
  mediaContainerWidth.value = mediaContainerRef.value?.clientWidth ?? 0;
};

const markLoaded = (key: string) => {
  loaded.value[key] = true;
};

const markFailed = (key: string) => {
  loaded.value[key] = true;
  failed.value[key] = true;
};

const formatSize = (size: number) => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};

const openMedia = (file: UploadPreview) => {
  if (!isReadyPreview(file)) {
    return;
  }

  const index = readyMediaAttachments.value.findIndex((item) => item.id === file.localId);

  if (index === -1) {
    return;
  }

  selectedMediaIndex.value = index;
  isViewerOpen.value = true;
};

watch(mediaPreviews, () => {
  const keys = new Set(mediaPreviews.value.map(keyOf));
  for (const key of Object.keys(loaded.value)) {
    if (!keys.has(key)) {
      delete loaded.value[key];
      delete failed.value[key];
    }
  }
  if (readyMediaAttachments.value.length <= 0) {
    isViewerOpen.value = false;
    selectedMediaIndex.value = 0;
    return;
  }

  selectedMediaIndex.value = Math.min(
    selectedMediaIndex.value,
    readyMediaAttachments.value.length - 1,
  );
});

onMounted(() => {
  updateMediaContainerWidth();
  if (import.meta.client && mediaContainerRef.value) {
    mediaResizeObserver = new ResizeObserver(updateMediaContainerWidth);
    mediaResizeObserver.observe(mediaContainerRef.value);
  }
});
watch(mediaContainerRef, (container) => {
  mediaResizeObserver?.disconnect();
  if (container) mediaResizeObserver?.observe(container);
  updateMediaContainerWidth();
});
onBeforeUnmount(() => mediaResizeObserver?.disconnect());
</script>

<template>
  <div class="overflow-y-auto p-2">
    <div v-if="mediaPreviews.length" ref="mediaContainerRef">
      <div class="relative overflow-hidden rounded-xs" :style="mediaContainerStyle">
        <div
          class="absolute overflow-hidden"
          v-for="{ file, style } in mediaItemEntries"
          :key="file.localId"
          :style="style"
        >
          <DialogMessagesListItemMediaTile
            v-if="isReadyPreview(file)"
            :item="previewToAttachment(file)"
            :loaded="loaded[keyOf(file)]"
            :failed="failed[keyOf(file)]"
            @open="openMedia(file)"
            @load="markLoaded(keyOf(file))"
            @error="markFailed(keyOf(file))"
          />
          <div class="bg-muted relative h-full w-full overflow-hidden" v-else>
            <div :class="skeletonClass" aria-hidden="true" />
          </div>

          <div
            class="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/35 p-2 text-white"
            v-if="file.uploading || file.error || failed[keyOf(file)]"
          >
            <template v-if="file.uploading">
              <UProgress class="w-full max-w-40" :model-value="file.progress" />
              <div class="text-xs font-medium">{{ file.progress }}%</div>
            </template>
            <template v-else>
              <UBadge
                color="neutral"
                variant="soft"
                :label="file.error || 'Не удалось загрузить'"
              />
              <UButton
                v-if="file.sourceFile"
                color="neutral"
                icon="i-ph-arrow-clockwise-bold"
                size="xs"
                variant="soft"
                label="Повторить"
                :disabled="props.loading"
                @click.stop="emit('retry', file)"
              />
            </template>
          </div>
          <UButton
            class="absolute top-1 right-1 z-10"
            color="neutral"
            :icon="file.uploading ? 'i-ph-stop-bold' : 'i-ph-x-bold'"
            size="xs"
            variant="soft"
            :disabled="props.loading"
            @click="file.uploading ? emit('cancel', file) : emit('remove', file)"
          />
        </div>
      </div>

      <PhotoViewer
        v-model:open="isViewerOpen"
        v-model:index="selectedMediaIndex"
        :items="readyMediaAttachments"
        sender-name="Медиа"
        title-mode="file"
        :downloadable="false"
      />
    </div>

    <div
      class="space-y-1 rounded-md"
      v-if="filePreviews.length"
      :class="{ 'pt-2': mediaPreviews.length }"
    >
      <Item v-for="file in filePreviews" :key="file.localId">
        <template #avatar>
          <UAvatar
            class="rounded-[0.75rem]"
            size="3xl"
            :icon="file.uploading ? 'i-ph-circle-notch-bold' : 'i-ph-file-bold'"
            :ui="{ icon: file.uploading ? 'animate-spin' : '' }"
          />
        </template>
        <template #heading>
          {{ file.name }}
        </template>
        <template #description>
          <div class="space-y-1">
            <div>{{ file.error || formatSize(file.size) }}</div>
            <UProgress v-if="file.uploading" :model-value="file.progress" />
          </div>
        </template>
        <template #action>
          <UButton
            v-if="file.error && file.sourceFile"
            color="neutral"
            icon="i-ph-arrow-clockwise-bold"
            size="xl"
            variant="ghost"
            :disabled="props.loading"
            @click="emit('retry', file)"
          />
          <UButton
            color="neutral"
            :icon="file.uploading ? 'i-ph-stop-bold' : 'i-ph-x-bold'"
            size="xl"
            variant="ghost"
            :disabled="props.loading"
            @click="file.uploading ? emit('cancel', file) : emit('remove', file)"
          />
        </template>
      </Item>
    </div>
  </div>
</template>
