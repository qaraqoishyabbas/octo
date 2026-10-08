<script setup lang="ts">
import type { MessageAttachment } from '~/types';

const props = defineProps<{
  target?: string | null;
  enabled?: boolean;
  bottomTrigger?: number;
}>();

const content = useProfileContentStore().createScope('media');
const { loading, loadingMore, error, list: mediaFiles } = toRefs(content.state);
onUnmounted(content.dispose);
const isViewerOpen = ref(false);
const selectedMediaIndex = ref(0);
const dayjs = useDayjs();

type MediaMonthGroup = {
  key: string;
  label: string;
  files: MessageAttachment[];
};

const formatDuration = (duration?: number | null) => {
  if (!duration || duration <= 0) {
    return null;
  }

  const totalSeconds = Math.round(duration);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
  }

  return [minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
};

const isImage = (file: MessageAttachment) => file.mime_type.startsWith('image/');

const getMediaMonthKey = (file: MessageAttachment) => {
  if (!file.created_at) {
    return 'unknown';
  }

  const parsed = dayjs(file.created_at);

  return parsed.isValid() ? parsed.format('YYYY-MM') : 'unknown';
};

const formatMediaMonthLabel = (monthKey: string) => {
  if (monthKey === 'unknown') {
    return 'Без даты';
  }

  return dayjs(`${monthKey}-01`).format('MMMM YYYY');
};

const groupedMediaFiles = computed<MediaMonthGroup[]>(() => {
  const groups: MediaMonthGroup[] = [];
  const groupsByMonth = new Map<string, MediaMonthGroup>();

  mediaFiles.value.forEach((file) => {
    const monthKey = getMediaMonthKey(file);
    let group = groupsByMonth.get(monthKey);

    if (!group) {
      group = {
        key: monthKey,
        label: formatMediaMonthLabel(monthKey),
        files: [],
      };
      groupsByMonth.set(monthKey, group);
      groups.push(group);
    }

    group.files.push(file);
  });

  return groups;
});

const resetMedia = () => {
  content.$reset();
  isViewerOpen.value = false;
  selectedMediaIndex.value = 0;
};
const fetchMedia = async (options?: { force?: boolean }) => {
  if (!props.enabled || !props.target) {
    resetMedia();
    return;
  }
  await content.fetchData(props.target, options);
};

const openMedia = (file: MessageAttachment) => {
  selectedMediaIndex.value = Math.max(
    0,
    mediaFiles.value.findIndex((media) => media.id === file.id),
  );
  isViewerOpen.value = true;
};

watch(
  () => [props.target, props.enabled],
  () => {
    resetMedia();
    void fetchMedia();
  },
  { immediate: true },
);

watch(
  () => Number(props.bottomTrigger ?? 0),
  () => {
    if (props.enabled) {
      void fetchMedia();
    }
  },
);
</script>

<template>
  <div class="h-full">
    <ProfileListLoading v-if="loading" />
    <ProfileListError
      v-else-if="error"
      :badge="false"
      label="Не удалось загрузить медиа"
      @retry="fetchMedia()"
    />
    <ProfileListEmpty v-else-if="mediaFiles.length === 0" />
    <div class="space-y-5" v-else>
      <section v-for="group in groupedMediaFiles" :key="group.key">
        <div class="bg-elevated text-muted p-4 py-1 text-sm font-bold">{{ group.label }}</div>
        <div class="grid grid-cols-3 gap-0.5 sm:grid-cols-4">
          <template v-for="file in group.files" :key="file.id">
            <div
              class="bg-muted aspect-square cursor-pointer overflow-hidden rounded-xs text-left"
              v-if="isImage(file)"
              @click="openMedia(file)"
            >
              <img
                class="h-full w-full object-cover"
                :src="$storage(file.path)"
                :alt="file.original_name"
              />
            </div>
            <div
              class="bg-muted relative aspect-square cursor-pointer overflow-hidden rounded-xs"
              v-else
              @click="openMedia(file)"
            >
              <video
                class="h-full w-full object-cover"
                :src="$storage(file.path)"
                :poster="file.thumbnail_path ? $storage(file.thumbnail_path) : undefined"
                preload="metadata"
                playsinline
                muted
              />
              <span
                class="pointer-events-none absolute top-1/2 left-1/2 flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur"
              >
                <UIcon class="size-5" name="i-ph-play-fill" />
              </span>
              <span
                class="pointer-events-none absolute right-1 bottom-1 rounded bg-black/65 px-1.5 py-0.5 text-xs font-medium text-white"
                v-if="formatDuration(file.duration)"
              >
                {{ formatDuration(file.duration) }}
              </span>
            </div>
          </template>
        </div>
      </section>
      <ProfileListLoading v-if="loadingMore" more />
    </div>

    <PhotoViewer
      v-model:open="isViewerOpen"
      v-model:index="selectedMediaIndex"
      :items="mediaFiles"
    />
  </div>
</template>
