import { ref, watch, type Ref } from 'vue';

type CacheMedia = { mime_type?: string; size?: number; type?: string };

/** Use full cached bodies for playback; object URLs are owned by this component scope. */
export function useMediaCacheSource(
  file: Readonly<Ref<CacheMedia | null>>,
  url: Readonly<Ref<string | undefined>>,
  enabled: Readonly<Ref<boolean>>,
  options: { prefetch?: boolean } = {},
) {
  const settings = useMediaAutoDownloadStore();
  const source = ref<string>();
  const loading = ref(false);
  watch(
    [file, url, enabled],
    async ([currentFile, currentUrl, active], _previous, onCleanup) => {
      let cancelled = false;
      let objectUrl: string | undefined;
      onCleanup(() => {
        cancelled = true;
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      });
      source.value = undefined;
      loading.value = false;
      if (!active || !currentFile || !currentUrl) return;
      loading.value = true;
      try {
        if (options.prefetch) await settings.prefetch(currentFile, currentUrl);
        else await settings.waitForPrefetch(currentUrl);
        if (cancelled) return;
        if (typeof window !== 'undefined' && window.caches) {
          const response = await (await window.caches.open('storage-cache')).match(currentUrl);
          if (response?.status === 200) {
            const blob = await response.blob();
            if (cancelled) return;
            objectUrl = URL.createObjectURL(blob);
            source.value = objectUrl;
            return;
          }
        }
      } catch {
        /* Private browsing or unavailable CORS/cache support retain native loading. */
      } finally {
        if (!cancelled) loading.value = false;
      }
      if (!cancelled) source.value = currentUrl;
    },
    { immediate: true },
  );
  return { source, loading };
}
