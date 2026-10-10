<script setup lang="ts">
import type { MessageAttachment } from '~/types';

const props = defineProps<{
  target?: string | null;
  enabled?: boolean;
  bottomTrigger?: number;
}>();

const content = useProfileContentStore().createScope('files');
const { loading, loadingMore, error, list: files } = toRefs(content.state);
onUnmounted(content.dispose);
const dayjs = useDayjs();
const vMediaPrefetch = useMediaFilePrefetch();
const { downloadingKey, downloadMessageFile } = useFileDownload();

type FileMonthGroup = {
  key: string;
  label: string;
  files: MessageAttachment[];
};

const getFileMonthKey = (file: MessageAttachment) => {
  if (!file.created_at) {
    return 'unknown';
  }

  const parsed = dayjs(file.created_at);

  return parsed.isValid() ? parsed.format('YYYY-MM') : 'unknown';
};

const formatFileMonthLabel = (monthKey: string) => {
  if (monthKey === 'unknown') {
    return 'Без даты';
  }

  return dayjs(`${monthKey}-01`).format('MMMM YYYY');
};

const groupedFiles = computed<FileMonthGroup[]>(() => {
  const groups: FileMonthGroup[] = [];
  const groupsByMonth = new Map<string, FileMonthGroup>();

  files.value.forEach((file) => {
    const monthKey = getFileMonthKey(file);
    let group = groupsByMonth.get(monthKey);

    if (!group) {
      group = {
        key: monthKey,
        label: formatFileMonthLabel(monthKey),
        files: [],
      };
      groupsByMonth.set(monthKey, group);
      groups.push(group);
    }

    group.files.push(file);
  });

  return groups;
});

const resetFiles = () => {
  content.$reset();
};
const fetchFiles = async (options?: { force?: boolean }) => {
  if (!props.enabled || !props.target) {
    resetFiles();
    return;
  }
  await content.fetchData(props.target, options);
};

const formatSize = (size: number) => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};

const isDownloading = (file: MessageAttachment) => downloadingKey.value === file.id;

watch(
  () => [props.target, props.enabled],
  () => {
    resetFiles();
    void fetchFiles();
  },
  { immediate: true },
);

watch(
  () => Number(props.bottomTrigger ?? 0),
  () => {
    if (props.enabled) {
      void fetchFiles();
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
      label="Не удалось загрузить файлы"
      @retry="fetchFiles()"
    />
    <ProfileListEmpty v-else-if="files.length === 0" />
    <div class="space-y-5" v-else>
      <section v-for="group in groupedFiles" :key="group.key">
        <div class="bg-elevated text-muted p-4 py-1 text-sm font-bold">{{ group.label }}</div>
        <div v-for="file in group.files" v-media-prefetch="file" :key="file.id">
          <Item
            class="group bg-transparent hover:bg-neutral-500/10"
            @click="downloadMessageFile(file)"
          >
            <template v-slot:avatar>
              <UAvatar
                class="animate-spin rounded-[0.75rem]"
                v-if="isDownloading(file)"
                size="3xl"
                icon="i-ph-circle-notch-bold"
              />
              <div class="relative" v-else>
                <UAvatar
                  class="rounded-[0.75rem] transition-opacity group-hover:opacity-0"
                  size="3xl"
                  icon="i-ph-file-bold"
                />
                <UAvatar
                  class="absolute inset-0 rounded-[0.75rem] opacity-0 transition-opacity group-hover:opacity-100"
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
            </template>
          </Item>
        </div>
      </section>
      <ProfileListLoading v-if="loadingMore" more />
    </div>
  </div>
</template>
