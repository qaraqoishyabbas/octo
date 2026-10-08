self.addEventListener('install', () => self.skipWaiting());

const fallbackPreferences = {
  enabled: false,
  sound: true,
  badge: true,
  mentions_in_muted: false,
  show_text: false,
  show_names: false,
};

const readPreferences = async () => {
  try {
    const cache = await self.caches.open('octo-notification-settings-v1');
    const response = await cache.match('/__octo_notification_settings__');
    return response ? { ...fallbackPreferences, ...(await response.json()) } : fallbackPreferences;
  } catch {
    return fallbackPreferences;
  }
};

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }
  const data = payload.data || {};
  event.waitUntil(
    (async () => {
      const preferences = await readPreferences();
      if (!preferences.enabled) {
        await self.navigator.clearAppBadge?.();
        return;
      }
      if (preferences.badge && typeof data.badge === 'number' && self.navigator.setAppBadge) {
        if (data.badge > 0) await self.navigator.setAppBadge(data.badge);
        else if (self.navigator.clearAppBadge) await self.navigator.clearAppBadge();
      }
      if (data.muted && (!data.mentioned || !preferences.mentions_in_muted)) return;
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (
        windows.some(
          (client) =>
            client.visibilityState === 'visible' &&
            new URL(client.url).origin === self.location.origin,
        )
      ) {
        return;
      }
      await self.registration.showNotification(
        preferences.show_names ? payload.title || 'Octo' : 'Новое уведомление',
        {
          body: preferences.show_text ? payload.body || '' : 'Содержимое скрыто',
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          silent: Boolean(data.silent || !preferences.sound),
          tag: data.message_id || undefined,
          data: {
            url: typeof data.url === 'string' && data.url.startsWith('/@') ? data.url : '/',
            dialog_id: typeof data.dialog_id === 'string' ? data.dialog_id : null,
          },
        },
      );
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin);
  if (url.origin !== self.location.origin) return;
  event.waitUntil(
    (async () => {
      const dialogId = event.notification.data?.dialog_id;
      if (dialogId) {
        try {
          const notifications = await self.registration.getNotifications();
          for (const notification of notifications) {
            if (notification.data?.dialog_id === dialogId) notification.close();
          }
        } catch {
          // A notification lookup failure must not prevent opening the dialog.
        }
      }
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = windows.find((client) => new URL(client.url).origin === url.origin);
      if (existing) {
        await existing.navigate(url.href);
        return existing.focus();
      }
      return self.clients.openWindow(url.href);
    })(),
  );
});
