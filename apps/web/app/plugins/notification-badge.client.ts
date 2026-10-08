import { closeDialogNotifications } from '~/utils/push-notifications';

export default defineNuxtPlugin(() => {
  const dialogs = useDialogsStore();
  const dialog = useDialogStore();
  const auth = useAuthStore();
  const notification = useNotificationStore();
  void notification.syncWorkerPreferences().catch(() => {});

  const closeCurrentDialogNotifications = async (dialogId = dialog.current?.dialog_id) => {
    if (!dialogId || !('serviceWorker' in navigator)) return;
    try {
      const registration = await navigator.serviceWorker.getRegistration('/push/');
      if (registration) await closeDialogNotifications(registration, dialogId);
    } catch {
      // Notification cleanup should not interrupt opening the dialog.
    }
  };

  watch(
    () => dialog.current?.dialog_id,
    (dialogId) => void closeCurrentDialogNotifications(dialogId),
    { immediate: true },
  );

  const closeOnResume = () => {
    if (document.visibilityState === 'visible') void closeCurrentDialogNotifications();
  };
  document.addEventListener('visibilitychange', closeOnResume);
  window.addEventListener('focus', closeOnResume);

  watch(
    () => [
      auth.logged,
      notification.preferences.enabled,
      notification.preferences.badge,
      ...dialogs.list.map((dialog) => dialog.counter ?? 0),
    ],
    async () => {
      if (!('setAppBadge' in navigator)) return;
      if (!auth.logged || !notification.preferences.enabled || !notification.preferences.badge) {
        await navigator.clearAppBadge?.();
        return;
      }
      const unread = dialogs.list.reduce((count, dialog) => count + (dialog.counter ?? 0), 0);
      if (unread > 0) await navigator.setAppBadge(unread);
      else await navigator.clearAppBadge?.();
    },
    { immediate: true },
  );
});
