import type { MessageAttachment } from '~/types';

type DownloadableFile = {
  id?: string | number | null;
  path?: string | null;
  original_name?: string | null;
};

type DownloadFileOptions = {
  url: string;
  filename?: string | null;
  key?: string | number | null;
  cacheUrl?: string;
};

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

export function useFileDownload() {
  const toast = useToast();
  const fileDownloads = useFileDownloadsStore();
  const scopeId = fileDownloads.createScope();
  const downloadingKey = computed(() => fileDownloads.scopes[scopeId]?.downloadingKey ?? null);
  const loading = computed(() => fileDownloads.scopes[scopeId]?.loading ?? false);
  const error = computed(() => fileDownloads.scopes[scopeId]?.error ?? null);
  onScopeDispose(() => fileDownloads.releaseScope(scopeId));

  async function downloadFile(options: DownloadFileOptions) {
    if (!import.meta.client || loading.value) {
      return false;
    }

    const startedRevision = fileDownloads.revision;
    try {
      const blob = await fileDownloads.downloadFile(
        scopeId,
        options.url,
        options.key ?? options.url,
        options.cacheUrl,
      );
      if (startedRevision !== fileDownloads.revision || !fileDownloads.scopes[scopeId])
        return false;

      saveBlob(blob, options.filename?.trim() || 'file');

      return true;
    } catch (failure) {
      if (
        startedRevision !== fileDownloads.revision ||
        !fileDownloads.scopes[scopeId] ||
        (failure instanceof DOMException && failure.name === 'AbortError')
      )
        return false;
      toast.add({
        title: 'Не удалось скачать файл',
        color: 'error',
        icon: 'i-ph-warning-circle-fill',
        progress: false,
        duration: 2000,
        close: false,
      });

      return false;
    }
  }

  function downloadMessageFile(file: MessageAttachment | DownloadableFile) {
    if (!file.id) {
      return Promise.resolve(false);
    }

    return downloadFile({
      url: `attachments/${file.id}/download`,
      filename: file.original_name || 'file',
      key: file.id,
      cacheUrl: file.path ? $storage(file.path) : undefined,
    });
  }

  return {
    downloadingKey,
    loading,
    error,
    downloadMessageFile,
    downloadFile,
  };
}
