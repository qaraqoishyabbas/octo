type DialogNotification = {
  data?: { dialog_id?: string };
  close: () => void;
};

type NotificationRegistration = {
  getNotifications: () => Promise<readonly DialogNotification[]>;
};

export async function closeDialogNotifications(
  registration: NotificationRegistration,
  dialogId: string,
): Promise<void> {
  const notifications = await registration.getNotifications();
  for (const notification of notifications) {
    if (notification.data?.dialog_id === dialogId) notification.close();
  }
}
