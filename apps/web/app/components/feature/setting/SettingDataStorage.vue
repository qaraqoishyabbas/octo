<script setup lang="ts">
import {
  clearChatCache,
  formatStorageBytes,
  getChatCacheUsage,
  getDraftUsage,
} from '~/utils/storage-usage';
import type { ChatCacheKind } from '~/utils/storage-usage';

const emit = defineEmits<{ close: [boolean] }>();
const auth = useAuthStore();
const drafts = useMessagesDraftStore();
const { confirm } = useConfirm();
const toast = useToast();
const loading = ref(false);
const clearing = ref(false);
const cacheSupported = ref(false);
type StorageKind = ChatCacheKind | 'drafts';
type Usage = { bytes: number; count: number };
const usage = ref<Record<StorageKind, Usage | null>>({ media: null, data: null, drafts: null });
const error = ref('');
const rows: { kind: StorageKind; label: string; description: string }[] = [
  {
    kind: 'media',
    label: 'Фото, видео и файлы',
    description: 'Медиа, сохранённые приложением на этом устройстве.',
  },
  { kind: 'data', label: 'Данные чатов', description: 'Локальные копии ответов сервера.' },
  { kind: 'drafts', label: 'Черновики', description: 'Неотправленные тексты текущего аккаунта.' },
];

const refresh = async () => {
  if (loading.value) return;
  loading.value = true;
  error.value = '';
  cacheSupported.value = 'caches' in window;
  try {
    const results = await Promise.allSettled([
      cacheSupported.value ? getChatCacheUsage(window.caches, 'media') : Promise.resolve(null),
      cacheSupported.value ? getChatCacheUsage(window.caches, 'data') : Promise.resolve(null),
      Promise.resolve().then(() => getDraftUsage(window.localStorage, String(auth.user.id ?? ''))),
    ]);
    results.forEach((result, index) => {
      const kind = rows[index]!.kind;
      usage.value[kind] = result.status === 'fulfilled' ? result.value : null;
      if (result.status === 'rejected')
        error.value = 'Не удалось измерить часть данных. Попробуйте обновить.';
    });
  } finally {
    loading.value = false;
  }
};

const requestClear = (kind: StorageKind) => {
  if (loading.value || clearing.value) return;
  const userId = String(auth.user.id ?? '');
  confirm({
    title: kind === 'drafts' ? 'Удалить все черновики?' : 'Очистить кэш?',
    description:
      kind === 'drafts'
        ? 'Сохранённые неотправленные тексты этого аккаунта на устройстве будут удалены. Восстановить их нельзя.'
        : 'Будут удалены только локальные копии. Сообщения на сервере сохранятся. При открытии данные загрузятся снова.',
    confirmButtonText: kind === 'drafts' ? 'Удалить' : 'Очистить',
    confirmButtonColor: 'error',
    onConfirm: async () => {
      if (clearing.value || loading.value || String(auth.user.id ?? '') !== userId) return;
      clearing.value = true;
      try {
        if (kind === 'drafts') drafts.clearUser(userId);
        else await clearChatCache(window.caches, kind);
        await refresh();
        toast.add({
          title: kind === 'drafts' ? 'Черновики удалены' : 'Кэш очищен',
          color: 'success',
        });
      } catch {
        error.value = 'Не удалось очистить данные. Попробуйте ещё раз.';
      } finally {
        clearing.value = false;
      }
    },
  });
};

onMounted(refresh);
</script>

<template>
  <USlideover
    side="left"
    title="Данные и память"
    description="Использование памяти на этом устройстве"
  >
    <template #content>
      <AppBar>
        <template #left>
          <UButton
            color="neutral"
            icon="i-ph-x-bold"
            size="xl"
            variant="soft"
            aria-label="Закрыть данные и память"
            @click="emit('close', false)"
          />
        </template>
        <template #center>Данные и память</template>
        <template #right>
          <UButton
            color="neutral"
            icon="i-ph-arrow-clockwise-bold"
            size="xl"
            variant="soft"
            aria-label="Обновить использование памяти"
            :loading="loading"
            :disabled="clearing"
            @click="refresh"
          />
        </template>
      </AppBar>
      <div
        class="min-h-0 flex-1 space-y-4 overflow-y-auto px-2.5 pb-4"
        :aria-busy="loading || clearing"
      >
        <p class="text-muted px-3 text-sm">
          Память, которую приложение использует в этом браузере. Размер указан приблизительно, без
          скачанных вами файлов и файлов самого приложения.
        </p>
        <p class="text-error px-3 text-sm" v-if="error" role="alert">{{ error }}</p>
        <section class="bg-elevated space-y-3 rounded-md p-4" v-for="row in rows" :key="row.kind">
          <div class="flex items-center justify-between gap-3">
            <h2 class="font-semibold">{{ row.label }}</h2>
            <span class="text-muted shrink-0 text-sm" aria-live="polite">
              {{
                loading
                  ? 'Считаем…'
                  : usage[row.kind]
                    ? formatStorageBytes(usage[row.kind]!.bytes)
                    : 'Недоступно'
              }}
            </span>
          </div>
          <p class="text-muted text-sm">{{ row.description }}</p>
          <UButton
            color="neutral"
            variant="soft"
            block
            :label="row.kind === 'drafts' ? 'Удалить черновики' : 'Очистить кэш'"
            :disabled="loading || clearing || !usage[row.kind]?.count"
            @click="requestClear(row.kind)"
          />
        </section>
        <p class="text-muted px-3 text-sm" v-if="!loading && !cacheSupported">
          Управление кэшем недоступно в этом браузере.
        </p>
      </div>
    </template>
  </USlideover>
</template>
