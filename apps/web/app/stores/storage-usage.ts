import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import {
  clearChatCache,
  clearMediaCache,
  getChatCacheUsage,
  getDraftUsage,
  getMediaCacheUsage,
} from '../utils/storage-usage.ts';
import type { MediaCacheKind } from '../utils/storage-usage';

export type StorageCategory = MediaCacheKind | 'data' | 'drafts';
type Usage = { bytes: number; count: number };
const emptyUsage = () => ({ photos: null, videos: null, files: null, data: null, drafts: null });

export const useStorageUsageStore = defineStore('storage-usage', () => {
  const auth = useAuthStore();
  const drafts = useMessagesDraftStore();
  const usage = ref<Record<StorageCategory, Usage | null>>(emptyUsage());
  const loading = ref(false);
  const clearing = ref(false);
  const error = ref('');
  const cacheSupported = ref(false);
  let generation = 0;
  const totalBytes = computed(() =>
    Object.values(usage.value).reduce((total, item) => total + (item?.bytes ?? 0), 0),
  );

  const refresh = async () => {
    const request = ++generation;
    const userId = String(auth.user.id ?? '');
    loading.value = true;
    error.value = '';
    cacheSupported.value = 'caches' in window;
    const results = await Promise.allSettled([
      cacheSupported.value ? getMediaCacheUsage(window.caches) : Promise.resolve(null),
      cacheSupported.value ? getChatCacheUsage(window.caches, 'data') : Promise.resolve(null),
      Promise.resolve().then(() => getDraftUsage(window.localStorage, userId)),
    ]);
    if (request !== generation || String(auth.user.id ?? '') !== userId) return;
    usage.value = emptyUsage();
    const [media, data, draft] = results;
    if (media.status === 'fulfilled' && media.value) Object.assign(usage.value, media.value);
    if (data.status === 'fulfilled') usage.value.data = data.value;
    if (draft.status === 'fulfilled') usage.value.drafts = draft.value;
    if (results.some((result) => result.status === 'rejected'))
      error.value = 'Не удалось измерить часть данных. Попробуйте обновить.';
    loading.value = false;
  };

  const clear = async (categories: StorageCategory[]) => {
    if (clearing.value || loading.value) return;
    const userId = String(auth.user.id ?? '');
    clearing.value = true;
    error.value = '';
    try {
      const media = categories.filter((kind): kind is MediaCacheKind =>
        ['photos', 'videos', 'files'].includes(kind),
      );
      if (media.length && 'caches' in window) await clearMediaCache(window.caches, media);
      if (categories.includes('data') && 'caches' in window)
        await clearChatCache(window.caches, 'data');
      if (categories.includes('drafts')) drafts.clearUser(userId);
      await refresh();
    } catch (failure) {
      error.value = 'Не удалось очистить данные. Попробуйте ещё раз.';
      throw failure;
    } finally {
      clearing.value = false;
    }
  };

  watch(
    () => auth.user.id,
    () => {
      generation++;
      loading.value = false;
      usage.value = emptyUsage();
      error.value = '';
    },
  );
  return { usage, totalBytes, loading, clearing, cacheSupported, error, refresh, clear };
});
