import { defineStore } from 'pinia';
import { useNetwork } from '@vueuse/core';
import { computed, ref, watch, onScopeDispose } from 'vue';

export type AutoDownloadProfile = 'mobile' | 'wifi';
export type AutoDownloadKind = 'photos' | 'videos' | 'files';
export type AutoDownloadRule = { enabled: boolean; maxSizeMb: number };
export type AutoDownloadSettings = { enabled: boolean } & Record<
  AutoDownloadKind,
  AutoDownloadRule
>;
type DownloadableMedia = { mime_type?: string; size?: number; type?: string };
type ProfilePatch = { enabled?: boolean } & Partial<
  Record<AutoDownloadKind, Partial<AutoDownloadRule>>
>;
const prefix = 'octo:media-auto-download:v1:';
const kinds: AutoDownloadKind[] = ['photos', 'videos', 'files'];
const labels = { photos: 'Фото', videos: 'Видео', files: 'Файлы' };
const defaults = (limit: number): AutoDownloadSettings => ({
  enabled: true,
  photos: { enabled: true, maxSizeMb: limit },
  videos: { enabled: true, maxSizeMb: limit },
  files: { enabled: true, maxSizeMb: limit },
});
function normalized(
  value: Partial<AutoDownloadSettings> | undefined,
  fallback: AutoDownloadSettings,
) {
  const result = defaults(10);
  result.enabled = typeof value?.enabled === 'boolean' ? value.enabled : fallback.enabled;
  for (const kind of kinds) {
    const rule = value?.[kind];
    result[kind] = {
      enabled: typeof rule?.enabled === 'boolean' ? rule.enabled : fallback[kind].enabled,
      maxSizeMb:
        typeof rule?.maxSizeMb === 'number' && Number.isFinite(rule.maxSizeMb)
          ? Math.min(2000, Math.max(1, rule.maxSizeMb))
          : fallback[kind].maxSizeMb,
    };
  }
  return result;
}

export const useMediaAutoDownloadStore = defineStore('media-auto-download', () => {
  const auth = useAuthStore();
  const profiles = ref({ mobile: defaults(10), wifi: defaults(15) });
  const network = useNetwork({ window: typeof window === 'undefined' ? undefined : window });
  const detectedProfile = computed<AutoDownloadProfile | null>(() =>
    network.type.value === 'cellular'
      ? 'mobile'
      : network.type.value === 'wifi' || network.type.value === 'ethernet'
        ? 'wifi'
        : null,
  );
  const dataSaver = computed(() => network.saveData.value ?? false);
  const isOnline = network.isOnline;
  const activeProfile = computed<AutoDownloadProfile>(() => detectedProfile.value ?? 'mobile');
  const accountId = computed(() => String(auth.user?.id ?? ''));
  const inflight = new Map<string, Promise<boolean>>();
  const pending = new Map<string, { controller: AbortController; file: DownloadableMedia }>();

  const persist = () => {
    if (!accountId.value || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        prefix + accountId.value,
        JSON.stringify({ profiles: profiles.value }),
      );
    } catch {
      /* Settings continue to work when browser storage is unavailable. */
    }
  };
  watch(
    accountId,
    (id) => {
      for (const { controller } of pending.values()) controller.abort();
      pending.clear();
      inflight.clear();
      profiles.value = { mobile: defaults(10), wifi: defaults(15) };
      if (!id || typeof window === 'undefined') return;
      try {
        const stored = JSON.parse(window.localStorage.getItem(prefix + id) || 'null');
        if (!stored || typeof stored !== 'object') return;
        profiles.value = {
          mobile: normalized(stored.profiles?.mobile, defaults(10)),
          wifi: normalized(stored.profiles?.wifi, defaults(15)),
        };
      } catch {
        /* Corrupt or inaccessible saved settings fall back to defaults. */
      }
    },
    { immediate: true, flush: 'sync' },
  );

  onScopeDispose(() => {
    for (const { controller } of pending.values()) controller.abort();
    pending.clear();
    inflight.clear();
  });

  function updateProfile(profile: AutoDownloadProfile, patch: ProfilePatch) {
    const current = profiles.value[profile];
    profiles.value[profile] = normalized(
      {
        ...current,
        ...patch,
        photos: { ...current.photos, ...patch.photos },
        videos: { ...current.videos, ...patch.videos },
        files: { ...current.files, ...patch.files },
      },
      current,
    );
    persist();
  }
  function kindOf(file: DownloadableMedia): AutoDownloadKind {
    return file.type === 'file'
      ? 'files'
      : file.mime_type?.startsWith('image/')
        ? 'photos'
        : file.mime_type?.startsWith('video/')
          ? 'videos'
          : 'files';
  }
  function canAutoLoad(file: DownloadableMedia) {
    const profile = profiles.value[activeProfile.value];
    const rule = profile[kindOf(file)];
    return (
      !!accountId.value &&
      profile.enabled &&
      rule.enabled &&
      !dataSaver.value &&
      isOnline.value &&
      typeof file.size === 'number' &&
      Number.isFinite(file.size) &&
      file.size >= 0 &&
      file.size <= rule.maxSizeMb * 1024 ** 2
    );
  }
  function summary(profile: AutoDownloadProfile) {
    const settings = profiles.value[profile];
    if (!settings.enabled) return 'Выключена';
    return (
      kinds
        .filter((kind) => settings[kind].enabled)
        .map((kind) => `${labels[kind]} (${settings[kind].maxSizeMb} МБ)`)
        .join(', ') || 'Выключена'
    );
  }

  watch(
    [profiles, detectedProfile, dataSaver, isOnline],
    () => {
      for (const { controller, file } of pending.values()) {
        if (!canAutoLoad(file)) controller.abort();
      }
    },
    { deep: true, flush: 'sync' },
  );

  function prefetch(file: DownloadableMedia, url: string): Promise<boolean> {
    if (!canAutoLoad(file)) return Promise.resolve(false);
    const current = inflight.get(url);
    if (current) return current;
    const request = performPrefetch(file, url);
    inflight.set(url, request);
    void request.finally(() => {
      if (inflight.get(url) === request) inflight.delete(url);
    });
    return request;
  }

  async function waitForPrefetch(url: string): Promise<void> {
    const current = inflight.get(url);
    if (current) await current;
  }

  async function performPrefetch(file: DownloadableMedia, url: string): Promise<boolean> {
    if (
      !canAutoLoad(file) ||
      typeof window === 'undefined' ||
      !('caches' in window) ||
      pending.has(url)
    )
      return false;
    const startedAccount = accountId.value;
    const controller = new AbortController();
    pending.set(url, { controller, file });
    try {
      const cache = await window.caches.open('storage-cache');
      if (controller.signal.aborted || startedAccount !== accountId.value) return false;
      const cached = await cache.match(url);
      if (cached?.status === 200 || cached?.type === 'opaque') return true;
      if (!canAutoLoad(file) || controller.signal.aborted) return false;
      let responseStatus = 200;
      const blob = await $http<Blob>(url, {
        signal: controller.signal,
        credentials: 'omit',
        responseType: 'blob',
        headers: { Accept: '*/*' },
        onFetchResponse({ response }) {
          responseStatus = response.status;
        },
      });
      const size = blob.size;
      if (
        responseStatus !== 200 ||
        controller.signal.aborted ||
        startedAccount !== accountId.value ||
        !canAutoLoad({ ...file, size })
      )
        return false;
      await cache.put(
        url,
        new Response(blob, {
          headers: { 'Content-Type': blob.type || 'application/octet-stream' },
        }),
      );
      return true;
    } catch {
      return false;
    } finally {
      if (pending.get(url)?.controller === controller) pending.delete(url);
    }
  }

  return {
    profiles,
    detectedProfile,
    activeProfile,
    dataSaver,
    isOnline,
    updateProfile,
    canAutoLoad,
    summary,
    prefetch,
    waitForPrefetch,
  };
});
