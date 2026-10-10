export const CHAT_CACHE_NAMES = { media: 'storage-cache', data: 'api-cache' } as const;
export type ChatCacheKind = keyof typeof CHAT_CACHE_NAMES;

export async function getChatCacheUsage(storage: CacheStorage, kind: ChatCacheKind) {
  const name = CHAT_CACHE_NAMES[kind];
  if (!(await storage.keys()).includes(name)) return { bytes: 0, count: 0 };
  const cache = await storage.open(name);
  const requests = await cache.keys();
  let bytes = 0;
  for (const request of requests) {
    const response = await cache.match(request);
    if (response) bytes += (await response.blob()).size;
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
