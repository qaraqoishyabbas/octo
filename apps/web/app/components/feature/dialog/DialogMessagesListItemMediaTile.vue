<script setup lang="ts">
import type { MessageAttachment } from '~/types';

const props = defineProps<{
  item: MessageAttachment;
  loaded?: boolean;
  failed?: boolean;
  openable?: boolean;
}>();

const emit = defineEmits<{
  open: [];
  load: [];
  error: [];
}>();

const autoDownload = useMediaAutoDownloadStore();
const manuallyLoaded = ref(false);
const mounted = ref(false);
onMounted(() => {
  mounted.value = true;
});
const loadAllowed = computed(
  () => mounted.value && (manuallyLoaded.value || autoDownload.canAutoLoad(props.item)),
);
watch(
  () => props.item.id,
  () => {
    manuallyLoaded.value = false;
  },
);

const tileElement = ref<HTMLElement | null>(null);
const visible = ref(false);
let visibilityObserver: IntersectionObserver | null = null;
onMounted(() => {
  if (typeof IntersectionObserver === 'undefined' || !tileElement.value) {
    visible.value = true;
    return;
  }
  visibilityObserver = new IntersectionObserver(([entry]) => {
    visible.value = entry?.isIntersecting ?? false;
  });
  visibilityObserver.observe(tileElement.value);
});
onBeforeUnmount(() => visibilityObserver?.disconnect());
const cacheSourceUrl = computed(() =>
  props.item.mime_type.startsWith('image/')
    ? $storage(sourceOf(props.item))
    : $storage(props.item.path),
);
const cacheEnabled = computed(() => loadAllowed.value && (visible.value || manuallyLoaded.value));
const { source: mediaSource } = useMediaCacheSource(
  computed(() => props.item),
  cacheSourceUrl,
  cacheEnabled,
  { prefetch: true },
);

const skeletonClass = 'absolute inset-0 animate-pulse bg-neutral-200 dark:bg-elevated';

function sourceOf(item: MessageAttachment) {
  return item.thumbnail_path || item.path;
}

function formatDuration(duration?: number | null) {
  if (!duration || duration <= 0) return null;

  const totalSeconds = Math.round(duration);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
  }

  return [minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
}

const durationLabel = computed(() => formatDuration(props.item.duration));

function open(event: MouseEvent) {
  if (!props.openable) {
    return;
  }

  manuallyLoaded.value = true;
  emit('open');
}
</script>

<template>
  <div class="bg-muted relative h-full w-full overflow-hidden rounded-xs" ref="tileElement">
    <div v-if="loadAllowed && !loaded" :class="skeletonClass" aria-hidden="true" />

    <div
      class="absolute inset-0 block text-left"
      v-if="item.mime_type.startsWith('image/')"
      :aria-label="item.original_name || 'image'"
      @click="open"
    >
      <img
        class="absolute inset-0 h-full w-full rounded-xs object-cover transition-opacity duration-300"
        :src="mediaSource"
        alt=""
        :width="item.width || undefined"
        :height="item.height || undefined"
        loading="lazy"
        decoding="async"
        referrerpolicy="no-referrer"
        :class="loaded && mediaSource && !failed ? 'opacity-100' : 'opacity-0'"
        @load="emit('load')"
        @error="emit('error')"
      />
    </div>

    <div
      class="absolute inset-0 block text-left"
      v-else-if="item.mime_type.startsWith('video/')"
      :aria-label="item.original_name || 'video'"
      @click="open"
    >
      <video
        class="absolute inset-0 h-full w-full object-cover transition-opacity duration-300"
        :src="mediaSource"
        :poster="loadAllowed && item.thumbnail_path ? $storage(item.thumbnail_path) : undefined"
        :preload="loadAllowed ? 'auto' : 'none'"
        playsinline
        muted
        :class="loaded ? 'opacity-100' : 'opacity-0'"
        @loadedmetadata="emit('load')"
        @error="emit('error')"
      />
      <span
        class="pointer-events-none absolute top-1/2 left-1/2 flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur"
      >
        <UIcon class="size-5" name="i-ph-play-fill" />
      </span>
      <span
        class="pointer-events-none absolute right-1 bottom-1 rounded bg-black/65 px-1.5 py-0.5 text-xs font-medium text-white"
        v-if="durationLabel"
      >
        {{ durationLabel }}
      </span>
    </div>

    <button
      class="absolute inset-0 flex items-center justify-center bg-black/10 text-white"
      v-if="!loadAllowed && openable"
      type="button"
      :aria-label="`Загрузить ${item.original_name || 'медиа'}`"
      @click="open"
    >
      <span class="flex size-10 items-center justify-center rounded-full bg-black/45 backdrop-blur"
        ><UIcon class="size-5" name="i-ph-arrow-down-bold"
      /></span>
    </button>
    <div class="absolute inset-0 flex items-center justify-center p-2" v-if="failed && loadAllowed">
      <UBadge color="neutral" variant="soft" label="Не удалось загрузить" />
    </div>
  </div>
</template>
