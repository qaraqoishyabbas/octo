<script setup lang="ts">
import type { MessageAttachment } from '~/types';

const props = withDefaults(
  defineProps<{
    images?: MessageAttachment[];
    items?: MessageAttachment[];
    senderName?: string | null;
    downloadable?: boolean;
    rotatable?: boolean;
    titleMode?: 'sender' | 'file';
    showFileSubtitle?: boolean;
  }>(),
  {
    images: () => [],
    items: () => [],
    senderName: null,
    downloadable: true,
    rotatable: true,
    titleMode: 'sender',
    showFileSubtitle: true,
  },
);

const open = defineModel<boolean>('open', { default: false });
const selectedIndex = defineModel<number>('index', { default: 0 });

const mediaItems = computed(() => (props.items.length ? props.items : props.images));
const selectedMedia = computed(() => mediaItems.value[selectedIndex.value] ?? null);
const isSelectedImage = computed(() => selectedMedia.value?.mime_type?.startsWith('image/'));
const isSelectedVideo = computed(() => selectedMedia.value?.mime_type?.startsWith('video/'));
const { source: videoSource } = useMediaCacheSource(
  selectedMedia,
  computed(() => (selectedMedia.value ? $storage(selectedMedia.value.path) : undefined)),
  computed(() => open.value && !!isSelectedVideo.value),
);
const canNavigateMedia = computed(() => mediaItems.value.length > 1);
const viewerTitle = computed(() => {
  if (props.titleMode === 'file') {
    return selectedMedia.value?.original_name || 'Медиа';
  }

  return selectedMedia.value?.uploader?.name?.trim() || props.senderName?.trim() || 'Медиа';
});
const viewerCounter = computed(() => {
  const total = mediaItems.value.length;

  if (total <= 0) return '';

  return `${selectedIndex.value + 1} / ${total}`;
});
const zoom = ref(1);
const rotation = ref(0);
const pan = ref({ x: 0, y: 0 });
const dragStart = ref<{ x: number; y: number; panX: number; panY: number } | null>(null);
const autoDownload = useMediaAutoDownloadStore();
const requestedAdjacent = ref<1 | -1 | null>(null);
const swipeOffset = ref({ x: 0, y: 0 });
const settling = ref(false);
const dragging = ref(false);
const viewportWidth = ref(0);
let settleTimer: ReturnType<typeof setTimeout> | null = null;
const slideDuration = 220;
const slideStyle = computed(() => ({
  transform: `translate3d(${swipeOffset.value.x}px, ${swipeOffset.value.y}px, 0)`,
  transition: settling.value
    ? `transform ${slideDuration}ms cubic-bezier(0.22, 1, 0.36, 1)`
    : 'none',
}));
const adjacentMedia = computed(() => {
  const total = mediaItems.value.length;
  if (!open.value || total <= 1) return [];
  return ([-1, 1] as const).map((direction) => ({
    direction,
    item: mediaItems.value[(selectedIndex.value + direction + total) % total]!,
    loadAllowed:
      requestedAdjacent.value === direction ||
      autoDownload.canAutoLoad(
        mediaItems.value[(selectedIndex.value + direction + total) % total]!,
      ),
  }));
});
const pointers = new Map<number, { x: number; y: number }>();
let pinchStart: { distance: number; zoom: number } | null = null;
let wasPinching = false;
const { downloadingKey, downloadMessageFile } = useFileDownload();
const downloading = computed(() => downloadingKey.value === selectedMedia.value?.id);
const imageTransform = computed(
  () =>
    `translate3d(${pan.value.x}px, ${pan.value.y}px, 0) scale(${zoom.value}) rotate(${rotation.value}deg)`,
);

function cancelSettling() {
  if (settleTimer !== null) clearTimeout(settleTimer);
  settleTimer = null;
  settling.value = false;
}

function settleTo(offset: { x: number; y: number }, complete?: () => void) {
  cancelSettling();
  dragging.value = false;
  if (import.meta.client && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    swipeOffset.value = { x: 0, y: 0 };
    complete?.();
    return;
  }
  settling.value = true;
  swipeOffset.value = offset;
  settleTimer = setTimeout(() => {
    settleTimer = null;
    settling.value = false;
    if (complete) complete();
    else {
      swipeOffset.value = { x: 0, y: 0 };
      requestedAdjacent.value = null;
    }
  }, slideDuration);
}

function resetView() {
  cancelSettling();
  requestedAdjacent.value = null;
  dragging.value = false;
  swipeOffset.value = { x: 0, y: 0 };
  zoom.value = 1;
  rotation.value = 0;
  pan.value = { x: 0, y: 0 };
  dragStart.value = null;
  pointers.clear();
  pinchStart = null;
  wasPinching = false;
}

function closeViewer() {
  resetView();
  open.value = false;
}

function navigateMedia(direction: 1 | -1) {
  const total = mediaItems.value.length;
  if (!open.value || total <= 1 || settling.value) return;
  viewportWidth.value = import.meta.client ? window.innerWidth : 0;
  requestedAdjacent.value = direction;
  // Reset zoom before sliding so the incoming media has its natural dimensions.
  zoom.value = 1;
  pan.value = { x: 0, y: 0 };
  rotation.value = 0;
  settleTo({ x: -direction * viewportWidth.value, y: 0 }, () => {
    selectedIndex.value = (selectedIndex.value + direction + total) % total;
    resetView();
  });
}

function setZoom(value: number) {
  if (!isSelectedImage.value) return;

  zoom.value = Math.min(5, Math.max(0.5, Number(value.toFixed(2))));

  if (zoom.value <= 1) {
    pan.value = { x: 0, y: 0 };
  }
}

function zoomBy(delta: number) {
  setZoom(zoom.value + delta);
}

function rotateImage() {
  if (!isSelectedImage.value) return;

  rotation.value = (rotation.value + 90) % 360;
}

function onViewerWheel(event: WheelEvent) {
  if (!isSelectedImage.value) return;

  event.preventDefault();
  zoomBy(event.deltaY > 0 ? -0.25 : 0.25);
}

function onPointerDown(event: PointerEvent) {
  if (
    !open.value ||
    settling.value ||
    !isSelectedImage.value ||
    (event.pointerType === 'mouse' && event.button !== 0)
  )
    return;

  (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
  viewportWidth.value = import.meta.client ? window.innerWidth : 0;
  dragging.value = true;
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pointers.size > 1) {
    wasPinching = true;
    requestedAdjacent.value = null;
    swipeOffset.value = { x: 0, y: 0 };
    pinchStart = { distance: pointerDistance(), zoom: zoom.value };
    dragStart.value = null;
    return;
  }
  dragStart.value = {
    x: event.clientX,
    y: event.clientY,
    panX: pan.value.x,
    panY: pan.value.y,
  };
}

function pointerDistance() {
  const [first, second] = [...pointers.values()];
  if (!first || !second) return 0;
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function onPointerMove(event: PointerEvent) {
  if (!pointers.has(event.pointerId)) return;
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pinchStart && pointers.size > 1) {
    if (pinchStart.distance > 0) {
      setZoom((pinchStart.zoom * pointerDistance()) / pinchStart.distance);
    }
    return;
  }
  if (!dragStart.value || !isSelectedImage.value) return;
  if (zoom.value <= 1) {
    if (wasPinching || event.pointerType === 'mouse') return;
    const x = event.clientX - dragStart.value.x;
    const y = event.clientY - dragStart.value.y;
    if (canNavigateMedia.value && Math.abs(x) > Math.abs(y) && Math.abs(x) >= 10) {
      requestedAdjacent.value = x < 0 ? 1 : -1;
    }
    swipeOffset.value =
      Math.abs(x) > Math.abs(y)
        ? { x: canNavigateMedia.value ? x : x * 0.2, y: 0 }
        : { x: 0, y: y > 0 ? y : y * 0.2 };
    return;
  }

  pan.value = {
    x: dragStart.value.panX + event.clientX - dragStart.value.x,
    y: dragStart.value.panY + event.clientY - dragStart.value.y,
  };
}

function onPointerUp(event: PointerEvent) {
  if (!pointers.has(event.pointerId)) return;
  const start = dragStart.value;
  pointers.delete(event.pointerId);
  const target = event.currentTarget as HTMLElement | null;
  if (target?.hasPointerCapture?.(event.pointerId)) {
    target.releasePointerCapture(event.pointerId);
  }
  if (
    event.type === 'pointerup' &&
    event.pointerType !== 'mouse' &&
    !wasPinching &&
    start &&
    zoom.value <= 1
  ) {
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaX) >= 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      if (canNavigateMedia.value) navigateMedia(deltaX < 0 ? 1 : -1);
      else settleTo({ x: 0, y: 0 });
    } else if (deltaY >= 120 && deltaY > Math.abs(deltaX) * 1.5) {
      // Keep the dismissed image offscreen throughout the modal exit transition.
      settleTo({ x: 0, y: import.meta.client ? window.innerHeight : deltaY }, () => {
        open.value = false;
      });
    } else {
      settleTo({ x: 0, y: 0 });
    }
  } else if (!wasPinching && zoom.value <= 1) {
    settleTo({ x: 0, y: 0 });
  }
  pinchStart = null;
  dragStart.value = null;
  const remaining = [...pointers.values()][0];
  if (remaining) {
    dragStart.value = { ...remaining, panX: pan.value.x, panY: pan.value.y };
  } else {
    wasPinching = false;
    dragging.value = false;
  }
}

async function downloadImage() {
  if (!selectedMedia.value || downloading.value) return;

  await downloadMessageFile(selectedMedia.value);
}

function toggleZoom() {
  if (!isSelectedImage.value) return;

  if (zoom.value > 1) {
    resetView();
    return;
  }

  zoomBy(1.5);
}

function onViewerKeydown(event: KeyboardEvent) {
  if (!open.value) return;

  if (event.key === 'Escape') {
    closeViewer();
  } else if (event.key === 'ArrowRight') {
    navigateMedia(1);
  } else if (event.key === 'ArrowLeft') {
    navigateMedia(-1);
  } else if (isSelectedImage.value && (event.key === '+' || event.key === '=')) {
    zoomBy(0.5);
  } else if (isSelectedImage.value && event.key === '-') {
    zoomBy(-0.5);
  } else if (isSelectedImage.value && event.key === '0') {
    resetView();
  } else if (isSelectedImage.value && event.key.toLowerCase() === 'r') {
    rotateImage();
  } else {
    return;
  }

  event.preventDefault();
}

watch(
  () => mediaItems.value.length,
  (length) => {
    if (length <= 0) {
      selectedIndex.value = 0;
      open.value = false;
      return;
    }

    selectedIndex.value = Math.min(Math.max(selectedIndex.value, 0), length - 1);
  },
);

watch(selectedIndex, resetView, { flush: 'sync' });

watch(open, async (isOpen) => {
  if (isOpen) resetView();
  else cancelSettling();
  if (!import.meta.client) return;

  if (isOpen) {
    await nextTick();
    window.addEventListener('keydown', onViewerKeydown);
    return;
  }

  window.removeEventListener('keydown', onViewerKeydown);
});

onBeforeUnmount(() => {
  cancelSettling();
  if (import.meta.client) {
    window.removeEventListener('keydown', onViewerKeydown);
  }
});
</script>

<template>
  <UModal
    v-model:open="open"
    :title="selectedMedia?.original_name || 'Медиа'"
    :ui="{ content: 'm-0 h-dvh max-h-dvh w-screen max-w-none rounded-none sm:rounded-none' }"
    fullscreen
  >
    <template #content>
      <div class="relative flex h-dvh w-screen flex-col overflow-hidden select-none">
        <div class="absolute inset-x-0 top-0 z-20">
          <div class="relative flex h-[60px] items-center justify-center gap-1.5">
            <div class="bg-elevated absolute left-4 flex rounded-md p-0.5 shadow-lg">
              <UButton
                icon="i-ph-x-bold"
                size="xl"
                color="neutral"
                variant="soft"
                @click="closeViewer"
              />
            </div>
            <div class="bg-elevated flex rounded-md p-0.5 shadow-lg">
              <div class="flex h-[40px] flex-col items-center rounded-md px-4 text-center">
                <div class="text-md line-clamp-1 space-x-0.5 font-semibold">
                  <span class="truncate wrap-anywhere whitespace-pre-line">
                    {{ viewerTitle }}
                  </span>
                </div>

                <div
                  class="text-muted line-clamp-1 truncate text-xs font-normal"
                  v-if="showFileSubtitle"
                >
                  {{ selectedMedia?.original_name }}
                </div>
              </div>
            </div>
            <div class="bg-elevated absolute right-4 flex rounded-md p-0.5 shadow-lg">
              <UButton
                class="hidden md:inline-flex"
                v-if="isSelectedImage"
                icon="i-ph-minus-bold"
                size="xl"
                color="neutral"
                variant="soft"
                @click="zoomBy(-0.5)"
              />
              <UButton
                class="hidden md:inline-flex"
                v-if="isSelectedImage"
                icon="i-ph-plus-bold"
                size="xl"
                color="neutral"
                variant="soft"
                @click="zoomBy(0.5)"
              />
              <UButton
                v-if="isSelectedImage && rotatable"
                icon="i-ph-arrow-clockwise-bold"
                size="xl"
                color="neutral"
                variant="soft"
                @click="rotateImage"
              />
              <UButton
                v-if="downloadable"
                :icon="downloading ? 'i-ph-circle-notch-bold' : 'i-ph-download-simple-bold'"
                size="xl"
                color="neutral"
                variant="soft"
                :loading="downloading"
                @click="downloadImage"
              />
            </div>
          </div>
        </div>

        <div class="absolute top-16 left-1/2 z-20 -translate-x-1/2">
          <UBadge :label="viewerCounter" color="neutral" variant="soft" />
        </div>

        <UButton
          class="absolute top-1/2 left-2 z-20 mt-8 hidden -translate-y-1/2 md:inline-flex"
          v-if="canNavigateMedia"
          @click="navigateMedia(-1)"
          size="xl"
          color="neutral"
          variant="soft"
          icon="i-ph-caret-left-bold"
        />
        <UButton
          class="absolute top-1/2 right-2 z-20 mt-8 hidden -translate-y-1/2 md:inline-flex"
          v-if="canNavigateMedia"
          @click="navigateMedia(1)"
          size="xl"
          color="neutral"
          variant="soft"
          icon="i-ph-caret-right-bold"
        />

        <div
          class="relative flex min-h-0 flex-1 touch-none items-center justify-center overflow-hidden pt-16"
          :class="zoom > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'"
          @wheel="onViewerWheel"
          @dblclick="toggleZoom"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerUp"
          @lostpointercapture="onPointerUp"
        >
          <div
            class="pointer-events-none absolute inset-0 flex items-center justify-center pt-16"
            v-for="adjacent in adjacentMedia"
            :key="adjacent.direction"
            aria-hidden="true"
            :style="{
              ...slideStyle,
              transform: `translate3d(${swipeOffset.x + adjacent.direction * viewportWidth}px, 0, 0)`,
              visibility: dragging || settling ? 'visible' : 'hidden',
            }"
          >
            <img
              class="max-h-full max-w-full object-contain"
              v-if="
                adjacent.loadAllowed &&
                (adjacent.item.mime_type?.startsWith('image/') || adjacent.item.thumbnail_path)
              "
              :src="
                $storage(
                  adjacent.item.mime_type?.startsWith('image/')
                    ? adjacent.item.path
                    : adjacent.item.thumbnail_path!,
                )
              "
              alt=""
              draggable="false"
            />
          </div>
          <div class="flex h-full w-full items-center justify-center" :style="slideStyle">
            <img
              class="photo-viewer-image max-h-full max-w-full object-contain"
              v-if="open && isSelectedImage && selectedMedia"
              :class="{ 'photo-viewer-image--active': dragging }"
              :src="$storage(selectedMedia.path)"
              :alt="selectedMedia.original_name"
              :style="{ transform: imageTransform }"
              draggable="false"
            />
            <video
              class="max-h-full max-w-full"
              v-else-if="open && isSelectedVideo && selectedMedia"
              :src="videoSource"
              :poster="
                selectedMedia.thumbnail_path ? $storage(selectedMedia.thumbnail_path) : undefined
              "
              controls
              autoplay
              playsinline
            />
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.photo-viewer-image {
  transition: transform 100ms ease-out;
}
.photo-viewer-image--active {
  transition: none;
}
@media (prefers-reduced-motion: reduce) {
  .photo-viewer-image {
    transition: none;
  }
}
</style>
