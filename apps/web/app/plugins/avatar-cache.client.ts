import { migrateAvatarCache } from '~/utils/storage-usage';

export default defineNuxtPlugin(() => {
  if (!('caches' in window)) return;
  // Migrate legacy entries without delaying the app or dropping originals on failure.
  void migrateAvatarCache(window.caches).catch(() => {});
});
