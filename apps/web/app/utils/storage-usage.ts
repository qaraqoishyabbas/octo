export const CHAT_CACHE_NAMES = {
  media: 'storage-cache',
  avatars: 'avatars-cache',
  data: 'api-cache',
} as const;
export type ChatCacheKind = keyof typeof CHAT_CACHE_NAMES;
export type MediaCacheKind = 'photos' | 'videos' | 'files';
export type CacheUsage = { bytes: number; count: number; unknownCount?: number };

export function isAvatarCacheRequest(request: Request | string) {
  const url = typeof request === 'string' ? request : request.url;
  try {
    return /\/storage\/avatars\//i.test(new URL(url, 'https://cache.local').pathname);
  } catch {
    return false;
  }
}

const migrations = new WeakMap<CacheStorage, Promise<void>>();
export async function migrateAvatarCache(storage: CacheStorage) {
  const pending = migrations.get(storage);
  if (pending) return pending;
  const migrate = async () => {
    if (!(await storage.keys()).includes(CHAT_CACHE_NAMES.media)) return;
    const media = await storage.open(CHAT_CACHE_NAMES.media);
    for (const request of await media.keys()) {
      if (!isAvatarCacheRequest(request)) continue;
      const response = await media.match(request);
      if (!response) continue;
      const avatars = await storage.open(CHAT_CACHE_NAMES.avatars);
      if (!(await avatars.match(request))) await avatars.put(request, response);
      await media.delete(request);
    }
  };
  const operation = migrate();
  migrations.set(storage, operation);
  try {
    await operation;
  } finally {
    migrations.delete(storage);
  }
}

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

export function mediaCacheKind(response: Response, request?: Request | string): MediaCacheKind {
  const type = response.headers.get('content-type') ?? '';
  if (type.startsWith('image/')) return 'photos';
  if (type.startsWith('video/')) return 'videos';
  if (!type && request) {
    try {
      const path = new URL(
        typeof request === 'string' ? request : request.url,
        'https://cache.local',
      ).pathname;
      if (/\.(?:jpe?g|png|webp|gif|avif|svg|heic|bmp|ico|tiff?)$/i.test(path)) return 'photos';
      if (/\.(?:mp4|webm|mov|m4v|ogv|3gp|mkv)$/i.test(path)) return 'videos';
    } catch {
      /* Unknown URLs remain in the files category. */
    }
  }
  return 'files';
}

export async function getMediaCacheUsage(storage: CacheStorage) {
  const usage: Record<MediaCacheKind, CacheUsage> = {
    photos: { bytes: 0, count: 0 },
    videos: { bytes: 0, count: 0 },
    files: { bytes: 0, count: 0 },
  };
  if (!(await storage.keys()).includes(CHAT_CACHE_NAMES.media)) return usage;
  const cache = await storage.open(CHAT_CACHE_NAMES.media);
  for (const request of await cache.keys()) {
    if (isAvatarCacheRequest(request)) continue;
    const response = await cache.match(request);
    if (!response) continue;
    const category = usage[mediaCacheKind(response, request)];
    if (response.type === 'opaque') category.unknownCount = (category.unknownCount ?? 0) + 1;
    category.bytes += await responseBodyBytes(response);
    category.count++;
  }
  return usage;
}

export async function clearMediaCache(storage: CacheStorage, kinds: MediaCacheKind[]) {
  if (!(await storage.keys()).includes(CHAT_CACHE_NAMES.media)) return;
  const cache = await storage.open(CHAT_CACHE_NAMES.media);
  for (const request of await cache.keys()) {
    if (isAvatarCacheRequest(request)) continue;
    const response = await cache.match(request);
    if (response && kinds.includes(mediaCacheKind(response, request))) await cache.delete(request);
  }
}

export async function getChatCacheUsage(storage: CacheStorage, kind: ChatCacheKind) {
  const name = CHAT_CACHE_NAMES[kind];
  if (!(await storage.keys()).includes(name)) return { bytes: 0, count: 0 };
  const cache = await storage.open(name);
  const requests = await cache.keys();
  let bytes = 0;
  let unknownCount = 0;
  for (const request of requests) {
    const response = await cache.match(request);
    if (response) {
      if (response.type === 'opaque') unknownCount++;
      bytes += await responseBodyBytes(response);
    }
  }
  return { bytes, count: requests.length, ...(unknownCount ? { unknownCount } : {}) };
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

export function formatCacheUsage(usage: CacheUsage) {
  if (usage.unknownCount && !usage.bytes) return 'Размер недоступен';
  return `${usage.unknownCount ? '≥ ' : ''}${formatStorageBytes(usage.bytes)}`;
}
