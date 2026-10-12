<script setup lang="ts">
import type { MessageAttachment } from '~/types';
import {
  calculateAlbumLayout,
  calculateMessageMediaDimensions,
  type MediaLayout,
} from '~/utils/messageMediaLayout';

const props = defineProps<{
  files?: MessageAttachment[];
  senderName?: string | null;
  sentAt?: string | null;
  hasTextAbove?: boolean;
  mediaInteractive?: boolean;
}>();

const loaded = ref<Record<string, boolean>>({});
const failed = ref<Record<string, boolean>>({});
const isViewerOpen = ref(false);
const selectedMediaIndex = ref(0);
const mediaContainerRef = ref<HTMLElement | null>(null);
const mediaContainerWidth = ref(0);
let mediaResizeObserver: ResizeObserver | null = null;

const mediaFiles = computed(() => (props.files ?? []).filter((file) => file.type === 'media'));
const isAlbum = computed(() => mediaFiles.value.length > 1);
const albumLayout = computed(() => (isAlbum.value ? calculateAlbumLayout(mediaFiles.value) : null));
const singleDimensions = computed(() =>
  mediaFiles.value[0] ? calculateMessageMediaDimensions(mediaFiles.value[0]) : null,
);
const galleryElId = computed(() => `gallery_${String(mediaFiles.value[0]?.message_id ?? 0)}`);
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

function keyOf(item: MessageAttachment, index: number) {
  return String(item.id ?? `item-${index}`);
}

function onLoad(key: string) {
  loaded.value[key] = true;
}

function onError(key: string) {
  loaded.value[key] = true;
  failed.value[key] = true;
}

function openMedia(item: MessageAttachment) {
  if (props.mediaInteractive === false) {
    return;
  }

  selectedMediaIndex.value = Math.max(
    0,
    mediaFiles.value.findIndex((media) => media.id === item.id),
  );
  isViewerOpen.value = true;
}

function itemLayoutStyle(layout: MediaLayout) {
  const { x, y, width, height } = layout.dimensions;
  const scale = albumScale.value;

  return {
    left: `${Math.round(x * scale)}px`,
    top: `${Math.round(y * scale)}px`,
    width: `${Math.round(width * scale)}px`,
    height: `${Math.round(height * scale)}px`,
  };
}

function singleItemStyle() {
  if (!singleDimensions.value) return undefined;

  return {
    left: '0px',
    top: '0px',
    width: '100%',
    height: `${Math.round(singleDimensions.value.height * singleScale.value)}px`,
  };
}

function updateMediaContainerWidth() {
  mediaContainerWidth.value = mediaContainerRef.value?.clientWidth ?? 0;
}

onMounted(async () => {
  await nextTick();
  updateMediaContainerWidth();

  if (import.meta.client && mediaContainerRef.value) {
    mediaResizeObserver = new ResizeObserver(updateMediaContainerWidth);
    mediaResizeObserver.observe(mediaContainerRef.value);
  }
});

onBeforeUnmount(() => {
  mediaResizeObserver?.disconnect();
});
</script>

<template>
  <div
    class="-mx-2 w-[calc(100%+1rem)] px-2"
    v-if="mediaFiles.length"
    :id="galleryElId"
    ref="mediaContainerRef"
  >
    <div class="relative w-full overflow-hidden rounded-xs" :style="mediaContainerStyle">
      <div
        class="absolute overflow-hidden"
        v-for="(item, index) in mediaFiles"
        :key="item.id ?? `media-item-${index}`"
        :style="
          isAlbum && albumLayout?.layout[index]
            ? itemLayoutStyle(albumLayout.layout[index])
            : singleItemStyle()
        "
      >
        <DialogMessagesListItemMediaTile
          :item="item"
          :loaded="loaded[keyOf(item, index)]"
          :failed="failed[keyOf(item, index)]"
          :openable="mediaInteractive !== false"
          @open="openMedia(item)"
          @load="onLoad(keyOf(item, index))"
          @error="onError(keyOf(item, index))"
        />
      </div>
    </div>

    <PhotoViewer
      v-if="mediaInteractive !== false"
      v-model:open="isViewerOpen"
      v-model:index="selectedMediaIndex"
      :items="mediaFiles"
      :sender-name="senderName"
      :sent-at="sentAt"
    />
  </div>
</template>
