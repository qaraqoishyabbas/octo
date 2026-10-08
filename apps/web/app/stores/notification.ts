import { defineStore } from 'pinia';
import { useLocalStorage } from '@vueuse/core';
import { cacheNotificationPreferences } from '~/utils/notification-preferences';

export type NotificationPreferences = {
  enabled: boolean;
  sound: boolean;
  badge: boolean;
  mentions_in_muted: boolean;
  show_text: boolean;
  show_names: boolean;
};

export const defaultNotificationPreferences: NotificationPreferences = {
  enabled: true,
  sound: true,
  badge: true,
  mentions_in_muted: true,
  show_text: true,
  show_names: true,
};

export const useNotificationStore = defineStore('notification', () => {
  const preferences = useLocalStorage<NotificationPreferences>(
    'octo:notification-preferences:v1',
    defaultNotificationPreferences,
    { mergeDefaults: true },
  );

  const syncWorkerPreferences = async () => {
    if (!import.meta.client || !('caches' in window)) return;
    await cacheNotificationPreferences(caches, preferences.value);
  };

  const savePreference = async (field: keyof NotificationPreferences, value: boolean) => {
    const previous = preferences.value;
    preferences.value = { ...previous, [field]: value };
    try {
      await syncWorkerPreferences();
    } catch (error) {
      preferences.value = previous;
      throw error;
    }
  };

  const resetPreferences = async () => {
    const previous = preferences.value;
    preferences.value = { ...defaultNotificationPreferences };
    try {
      await syncWorkerPreferences();
    } catch (error) {
      preferences.value = previous;
      throw error;
    }
  };

  const getPublicKey = async (appId: string) => {
    const response = await $http<{ data: { public_key: string | null } }>(
      `notification-apps/${appId}/public-config`,
    );
    return response.data.public_key;
  };

  const registerPushToken = async (appId: string, token: string) => {
    const response = await $http<{ data: { id: string } }>('push-tokens', {
      method: 'POST',
      body: { app_id: appId, token },
    });
    return response.data.id;
  };

  const deletePushToken = async (id: string) => {
    await $http(`push-tokens/${id}`, { method: 'DELETE' });
  };

  return {
    preferences,
    syncWorkerPreferences,
    savePreference,
    resetPreferences,
    getPublicKey,
    registerPushToken,
    deletePushToken,
  };
});
