import type { NotificationPreferences } from '~/stores/notification';

export async function cacheNotificationPreferences(
  storage: {
    open: (name: string) => Promise<{ put: (key: string, value: Response) => Promise<unknown> }>;
  },
  preferences: NotificationPreferences,
): Promise<void> {
  const cache = await storage.open('octo-notification-settings-v1');
  await cache.put(
    '/__octo_notification_settings__',
    new Response(JSON.stringify(preferences), { headers: { 'Content-Type': 'application/json' } }),
  );
}
