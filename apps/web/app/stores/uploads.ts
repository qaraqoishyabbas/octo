import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

export type TemporaryUploadResponse = {
  id: string;
  path: string;
  type: string;
  mime_type: string;
  original_name: string;
  size: number;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
  thumbnail_path?: string | null;
};

type AvatarUploadResponse = {
  ok?: boolean;
  id?: string;
  path?: string;
  message?: string;
};

type UploadOptions = {
  signal?: AbortSignal;
  onProgress?: (progress: number) => void;
};

export const useUploadsStore = defineStore('uploads', () => {
  const config = useRuntimeConfig();
  const auth = useAuthStore();
  const activeOperations = ref<Record<string, { kind: 'avatar' | 'message'; progress: number }>>(
    {},
  );
  const loading = computed(() => Object.keys(activeOperations.value).length > 0);
  const error = ref<unknown>(null);
  const revision = ref(0);
  const cancellations = new Map<string, () => void>();
  let operationSequence = 0;

  const deleteTemporaryUpload = async (id: string) => {
    try {
      await $http(`upload/${id}`, { method: 'DELETE' });
    } catch {
      // Temporary cleanup is best-effort; hourly cleanup handles leftovers.
    }
  };

  const sendUpload = async <T extends { id?: string }>(
    body: FormData,
    options: UploadOptions,
    errorMessage: string,
    messageUpload: boolean,
  ) => {
    const startedRevision = revision.value;
    const response = await new Promise<T>((resolve, reject) => {
      const { signal, onProgress } = options;
      if (signal?.aborted) {
        reject(new DOMException('Upload aborted', 'AbortError'));
        return;
      }

      const xhr = new XMLHttpRequest();
      const networkUsage = useNetworkUsageStore();
      let networkAttempt: ReturnType<typeof networkUsage.beginAttempt> = null;
      const operationId = String(++operationSequence);
      activeOperations.value[operationId] = {
        kind: messageUpload ? 'message' : 'avatar',
        progress: 0,
      };
      error.value = null;
      let settled = false;
      const cleanup = () => {
        delete activeOperations.value[operationId];
        cancellations.delete(operationId);
        signal?.removeEventListener('abort', abortUpload);
        xhr.upload.onprogress = null;
        xhr.onload = null;
        xhr.onerror = null;
        xhr.onabort = null;
      };
      const fail = (failure: unknown) => {
        if (settled) return;
        settled = true;
        networkUsage.finishAttempt(networkAttempt, xhr.responseText, false);
        cleanup();
        if (
          startedRevision === revision.value &&
          !(failure instanceof DOMException && failure.name === 'AbortError')
        ) {
          error.value = failure;
        }
        reject(failure);
      };
      const abortUpload = () => {
        xhr.abort();
        // Aborting an unsent request need not dispatch an XHR abort event.
        fail(new DOMException('Upload aborted', 'AbortError'));
      };
      cancellations.set(operationId, abortUpload);

      try {
        xhr.open('POST', `${config.public.apiBase}${config.public.apiPrefix}/upload`);
        xhr.setRequestHeader('Accept', 'application/json');
        if (auth.token) {
          xhr.setRequestHeader('Authorization', `Bearer ${auth.token}`);
        }
        signal?.addEventListener('abort', abortUpload, { once: true });
        xhr.upload.onprogress = (event) => {
          if (settled) return;
          if (event.lengthComputable) {
            const progress = Math.min(99, Math.round((event.loaded / event.total) * 100));
            activeOperations.value[operationId]!.progress = progress;
            onProgress?.(progress);
          }
        };
        xhr.onload = () => {
          if (settled) return;
          let payload;
          try {
            payload = xhr.responseText ? JSON.parse(xhr.responseText) : null;
          } catch {
            fail(new Error(xhr.statusText || errorMessage));
            return;
          }
          if (xhr.status < 200 || xhr.status >= 300) {
            fail(
              messageUpload
                ? { data: payload, status: xhr.status }
                : (payload ?? new Error(xhr.statusText || errorMessage)),
            );
            return;
          }
          settled = true;
          networkUsage.finishAttempt(networkAttempt, xhr.responseText, true);
          cleanup();
          onProgress?.(100);
          resolve((payload ?? {}) as T);
        };
        xhr.onerror = () => fail(new Error(errorMessage));
        xhr.onabort = () => fail(new DOMException('Upload aborted', 'AbortError'));
        networkAttempt = networkUsage.beginAttempt(body);
        xhr.send(body);
      } catch (error) {
        fail(error);
      }
    });
    if (startedRevision !== revision.value) {
      if (response.id) await deleteTemporaryUpload(response.id);
      throw new DOMException('Upload aborted', 'AbortError');
    }
    return response;
  };

  const $reset = () => {
    revision.value += 1;
    for (const cancel of [...cancellations.values()]) cancel();
    activeOperations.value = {};
    error.value = null;
  };

  const uploadAvatar = (
    file: File,
    options: UploadOptions & {
      entity: string;
      width?: number;
      height?: number;
    },
  ) => {
    const body = new FormData();
    body.append('image', file);
    body.append('entity', options.entity);
    body.append('width', String(options.width ?? ''));
    body.append('height', String(options.height ?? ''));
    return sendUpload<AvatarUploadResponse>(body, options, 'Не удалось загрузить фото', false);
  };

  const uploadMessageFile = (file: File, options: UploadOptions & { type: 'media' | 'file' }) => {
    const body = new FormData();
    body.append('file', file);
    body.append('entity', 'messages');
    body.append('type', options.type);
    return sendUpload<TemporaryUploadResponse>(body, options, 'Не удалось загрузить', true);
  };

  return {
    activeOperations,
    loading,
    error,
    revision,
    uploadAvatar,
    uploadMessageFile,
    deleteTemporaryUpload,
    $reset,
  };
});
