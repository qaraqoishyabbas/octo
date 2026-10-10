export const CHAT_CACHE_NAMES = { media: 'storage-cache', data: 'api-cache' } as const;
export type ChatCacheKind = keyof typeof CHAT_CACHE_NAMES;
export type MediaCacheKind = 'photos' | 'videos' | 'files';

async function responseBodyBytes(response: Response) {
  const declared = response.headers.get('content-length');
  if (declared !== null && /^\d+$/.test(declared)) {
    const size = Number(declared);
    if (Number.isSafeInteger(size)) return size;
  }
  if (!response.body) return 0;
  const reader = response.body.getReader();
  let bytes = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) return bytes;
      bytes += chunk.value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }
}

export function mediaCacheKind(response: Response): MediaCacheKind {
  const type = response.headers.get('content-type') ?? '';
  return type.startsWith('image/') ? 'photos' : type.startsWith('video/') ? 'videos' : 'files';
}

export async function getMediaCacheUsage(storage: CacheStorage) {
  const usage = {
    photos: { bytes: 0, count: 0 },
    videos: { bytes: 0, count: 0 },
    files: { bytes: 0, count: 0 },
  };
  if (!(await storage.keys()).includes(CHAT_CACHE_NAMES.media)) return usage;
  const cache = await storage.open(CHAT_CACHE_NAMES.media);
  for (const request of await cache.keys()) {
    const response = await cache.match(request);
    if (!response) continue;
    const category = usage[mediaCacheKind(response)];
    category.bytes += await responseBodyBytes(response);
    category.count++;
  }
  return usage;
}

export async function clearMediaCache(storage: CacheStorage, kinds: MediaCacheKind[]) {
  if (!(await storage.keys()).includes(CHAT_CACHE_NAMES.media)) return;
  const cache = await storage.open(CHAT_CACHE_NAMES.media);
  for (const request of await cache.keys()) {
    const response = await cache.match(request);
    if (response && kinds.includes(mediaCacheKind(response))) await cache.delete(request);
  }
}

export async function getChatCacheUsage(storage: CacheStorage, kind: ChatCacheKind) {
  const name = CHAT_CACHE_NAMES[kind];
  if (!(await storage.keys()).includes(name)) return { bytes: 0, count: 0 };
  const cache = await storage.open(name);
  const requests = await cache.keys();
  let bytes = 0;
  for (const request of requests) {
    const response = await cache.match(request);
    if (response) bytes += await responseBodyBytes(response);
  }
  return { bytes, count: requests.length };
}

export async function clearChatCache(storage: CacheStorage, kind: ChatCacheKind) {
  await storage.delete(CHAT_CACHE_NAMES[kind]);
}

export function getDraftUsage(storage: Storage, userId: string) {
  if (!userId) return { bytes: 0, count: 0 };
  const prefix = `octo:messages-draft:v1:${userId}:`;
  let bytes = 0;
  let count = 0;
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (!key?.startsWith(prefix)) continue;
    bytes += (key.length + (storage.getItem(key)?.length ?? 0)) * 2;
    count++;
  }
  return { bytes, count };
}

export function formatStorageBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} КБ`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} МБ`;
  return `${(bytes / 1024 ** 3).toFixed(1)} ГБ`;
}
