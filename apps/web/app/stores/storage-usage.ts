import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import {
  clearChatCache,
  clearMediaCache,
  getChatCacheUsage,
  getDraftUsage,
  getMediaCacheUsage,
  migrateAvatarCache,
} from '../utils/storage-usage.ts';
import type { MediaCacheKind, CacheUsage } from '../utils/storage-usage';

export type StorageCategory = MediaCacheKind | 'avatars' | 'data' | 'drafts';
type Usage = CacheUsage;
const emptyUsage = () => ({
  photos: null,
  videos: null,
  files: null,
  avatars: null,
  data: null,
  drafts: null,
});

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
  const totalUsage = computed(() => ({
    bytes: totalBytes.value,
    count: Object.values(usage.value).reduce((total, item) => total + (item?.count ?? 0), 0),
    unknownCount: Object.values(usage.value).reduce(
      (total, item) => total + (item?.unknownCount ?? 0),
      0,
    ),
  }));

  const refresh = async () => {
    const request = ++generation;
    const userId = String(auth.user.id ?? '');
    loading.value = true;
    error.value = '';
    cacheSupported.value = 'caches' in window;
    if (cacheSupported.value) {
      try {
        await migrateAvatarCache(window.caches);
      } catch {
        if (request === generation)
          error.value = 'Не удалось разделить старый кэш аватарок. Попробуйте обновить.';
      }
    }
    if (request !== generation || String(auth.user.id ?? '') !== userId) return;
    const results = await Promise.allSettled([
      cacheSupported.value ? getMediaCacheUsage(window.caches) : Promise.resolve(null),
      cacheSupported.value ? getChatCacheUsage(window.caches, 'data') : Promise.resolve(null),
      Promise.resolve().then(() => getDraftUsage(window.localStorage, userId)),
      cacheSupported.value ? getChatCacheUsage(window.caches, 'avatars') : Promise.resolve(null),
    ]);
    if (request !== generation || String(auth.user.id ?? '') !== userId) return;
    usage.value = emptyUsage();
    const [media, data, draft, avatars] = results;
    if (media.status === 'fulfilled' && media.value) Object.assign(usage.value, media.value);
    if (data.status === 'fulfilled') usage.value.data = data.value;
    if (draft.status === 'fulfilled') usage.value.drafts = draft.value;
    if (avatars.status === 'fulfilled') usage.value.avatars = avatars.value;
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
      if (categories.includes('avatars') && 'caches' in window)
        await clearChatCache(window.caches, 'avatars');
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
  return {
    usage,
    totalBytes,
    totalUsage,
    loading,
    clearing,
    cacheSupported,
    error,
    refresh,
    clear,
  };
});
