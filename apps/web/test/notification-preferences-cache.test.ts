import assert from 'node:assert/strict';
import test from 'node:test';

test('writes local preferences to the cache read by the push worker', async () => {
  const { cacheNotificationPreferences } = await import('../app/utils/notification-preferences.ts');
  let cacheName = '';
  let key = '';
  let response: Response | undefined;
  const storage = {
    open: async (name: string) => {
      cacheName = name;
      return {
        put: async (request: string, value: Response) => {
          key = request;
          response = value;
        },
      };
    },
  };

  await cacheNotificationPreferences(storage, {
    enabled: true,
    sound: false,
    badge: true,
    mentions_in_muted: false,
    show_text: false,
    show_names: true,
  });

  assert.equal(cacheName, 'octo-notification-settings-v1');
  assert.equal(key, '/__octo_notification_settings__');
  const saved = await response?.json();
  assert.equal(saved.sound, false);
  assert.equal(saved.show_text, false);
});
