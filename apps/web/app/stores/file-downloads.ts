import { defineStore } from 'pinia';
import { ref } from 'vue';

type DownloadScope = {
  downloadingKey: string | null;
  loading: boolean;
  error: unknown;
};

export const useFileDownloadsStore = defineStore('file-downloads', () => {
  const scopes = ref<Record<string, DownloadScope>>({});
  const revision = ref(0);
  const controllers = new Map<string, AbortController>();
  let scopeSequence = 0;

  const createScope = () => {
    const id = String(++scopeSequence);
    scopes.value[id] = { downloadingKey: null, loading: false, error: null };
    return id;
  };

  const releaseScope = (id: string) => {
    controllers.get(id)?.abort();
    controllers.delete(id);
    delete scopes.value[id];
  };

  const downloadFile = async (
    id: string,
    url: string,
    key: string | number = url,
    cacheUrl?: string,
  ) => {
    const scope = scopes.value[id];
    if (!scope || scope.loading) throw new Error('Download scope is unavailable');
    const controller = new AbortController();
    controllers.set(id, controller);
    scope.downloadingKey = String(key);
    scope.loading = true;
    scope.error = null;
    try {
      let cached: Response | undefined;
      if (cacheUrl && typeof window !== 'undefined' && window?.caches) {
        try {
          cached = await (await window.caches.open('storage-cache')).match(cacheUrl);
        } catch {
          /* Cache availability must not prevent an authorized download. */
        }
      }
      if (controller.signal.aborted || controllers.get(id) !== controller) {
        throw new DOMException('Download aborted', 'AbortError');
      }
      let blob: Blob;
      if (cached) {
        // Cached media still requires a fresh server permission check before saving.
        await $http(url, { method: 'HEAD', headers: { Accept: '*/*' }, signal: controller.signal });
        blob = await cached.blob();
      } else {
        blob = await $http<Blob>(url, {
          headers: { Accept: '*/*' },
          responseType: 'blob',
          signal: controller.signal,
        });
      }
      if (controller.signal.aborted || controllers.get(id) !== controller) {
        throw new DOMException('Download aborted', 'AbortError');
      }
      return blob;
    } catch (failure) {
      if (controllers.get(id) === controller && !controller.signal.aborted) scope.error = failure;
      throw failure;
    } finally {
      if (controllers.get(id) === controller) {
        controllers.delete(id);
        scope.downloadingKey = null;
        scope.loading = false;
      }
    }
  };

  const $reset = () => {
    revision.value += 1;
    for (const controller of controllers.values()) controller.abort();
    controllers.clear();
    for (const scope of Object.values(scopes.value)) {
      scope.downloadingKey = null;
      scope.loading = false;
      scope.error = null;
    }
  };

  return { scopes, revision, createScope, releaseScope, downloadFile, $reset };
});
