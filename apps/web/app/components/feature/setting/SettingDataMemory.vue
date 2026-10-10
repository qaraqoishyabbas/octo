<script setup lang="ts">
import { formatStorageBytes } from '~/utils/storage-usage';
import type { StorageCategory } from '~/stores/storage-usage';

const emit = defineEmits<{ close: [boolean] }>();
const memory = useStorageUsageStore();
const auth = useAuthStore();
const { confirm } = useConfirm();
const toast = useToast();
const selected = ref<StorageCategory[]>(['photos', 'videos', 'files', 'data']);
const rows: { kind: StorageCategory; label: string; color: string }[] = [
  { kind: 'photos', label: 'Фотографии', color: '#8b5cf6' },
  { kind: 'videos', label: 'Видео', color: '#3b82f6' },
  { kind: 'files', label: 'Файлы и другое медиа', color: '#14b8a6' },
  { kind: 'data', label: 'Данные чатов', color: '#f59e0b' },
  { kind: 'drafts', label: 'Черновики', color: '#f43f5e' },
];
const selectedBytes = computed(() =>
  selected.value.reduce((total, kind) => total + (memory.usage[kind]?.bytes ?? 0), 0),
);
const hasSelection = computed(() =>
  selected.value.some((kind) => (memory.usage[kind]?.count ?? 0) > 0),
);
const chart = computed(() => {
  let offset = 0;
  const slices = rows.map((row) => {
    const start = offset;
    offset += memory.totalBytes
      ? ((memory.usage[row.kind]?.bytes ?? 0) / memory.totalBytes) * 100
      : 0;
    return `${row.color} ${start}% ${offset}%`;
  });
  return memory.totalBytes ? `conic-gradient(${slices.join(',')})` : 'var(--ui-bg-elevated)';
});
const requestClear = () => {
  if (memory.loading || memory.clearing || !hasSelection.value) return;
  const categories = selected.value.filter((kind) => (memory.usage[kind]?.count ?? 0) > 0);
  const userId = auth.user.id;
  confirm({
    title: 'Очистить выбранные данные?',
    description: categories.includes('drafts')
      ? 'Выбранный кэш и черновики будут удалены с устройства. Черновики восстановить нельзя. Сообщения на сервере и вход в аккаунт сохранятся.'
      : 'Удалятся только локальные копии выбранных категорий. Сообщения на сервере сохранятся, медиа можно будет загрузить снова.',
    confirmButtonText: 'Очистить',
    confirmButtonColor: 'error',
    onConfirm: async () => {
      if (auth.user.id !== userId || memory.loading || memory.clearing) return;
      try {
        await memory.clear(categories);
        toast.add({ title: 'Выбранные данные очищены', color: 'success' });
      } catch {
        /* Error is displayed in the memory panel. */
      }
    },
  });
};
onMounted(() => memory.refresh());
</script>

<template>
  <USlideover side="left" title="Использование памяти" description="Кэш приложения на устройстве">
    <template #content>
      <AppBar>
        <template #left
          ><UButton
            color="neutral"
            icon="i-ph-x-bold"
            size="xl"
            variant="soft"
            aria-label="Закрыть использование памяти"
            @click="emit('close', false)"
        /></template>
        <template #center>Использование памяти</template>
        <template #right
          ><UButton
            color="neutral"
            icon="i-ph-arrow-clockwise-bold"
            size="xl"
            variant="soft"
            aria-label="Обновить использование памяти"
            :loading="memory.loading"
            :disabled="memory.clearing"
            @click="memory.refresh()"
        /></template>
      </AppBar>
      <div
        class="min-h-0 flex-1 space-y-4 overflow-y-auto px-2.5 pb-4"
        :aria-busy="memory.loading || memory.clearing"
      >
        <div
          class="relative mx-auto my-4 flex h-44 w-44 items-center justify-center rounded-full"
          :style="{ background: chart }"
          role="img"
          :aria-label="`Занято памяти: ${formatStorageBytes(memory.totalBytes)}`"
        >
          <div class="bg-default flex h-32 w-32 flex-col items-center justify-center rounded-full">
            <strong>{{
              memory.loading ? 'Считаем…' : formatStorageBytes(memory.totalBytes)
            }}</strong
            ><span class="text-muted text-xs">На устройстве</span>
          </div>
        </div>
        <p class="text-muted px-3 text-sm">
          Приблизительный размер локальных копий в этом браузере. Скачанные вами файлы и само
          приложение сюда не входят.
        </p>
        <p class="text-error px-3 text-sm" v-if="memory.error" role="alert">{{ memory.error }}</p>
        <div class="bg-elevated space-y-4 rounded-md p-4">
          <div class="flex items-center justify-between gap-3" v-for="row in rows" :key="row.kind">
            <UCheckbox
              :model-value="selected.includes(row.kind)"
              :label="row.label"
              :disabled="memory.loading || memory.clearing || !memory.usage[row.kind]?.count"
              @update:model-value="
                selected =
                  $event === true
                    ? [...new Set([...selected, row.kind])]
                    : selected.filter((kind) => kind !== row.kind)
              "
            />
            <span class="shrink-0 text-sm" :style="{ color: row.color }">{{
              memory.loading
                ? '…'
                : memory.usage[row.kind]
                  ? formatStorageBytes(memory.usage[row.kind]!.bytes)
                  : 'Недоступно'
            }}</span>
          </div>
        </div>
        <UButton
          block
          size="xl"
          color="primary"
          :label="`Очистить ${formatStorageBytes(selectedBytes)}`"
          :loading="memory.clearing"
          :disabled="memory.loading || memory.clearing || !hasSelection"
          @click="requestClear"
        />
        <p class="text-muted px-3 text-sm" v-if="!memory.loading && !memory.cacheSupported">
          Управление кэшем недоступно в этом браузере.
        </p>
      </div>
    </template>
  </USlideover>
</template>
