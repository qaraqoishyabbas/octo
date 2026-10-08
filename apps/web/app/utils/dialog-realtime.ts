import type { DialogMemberRole, DialogType } from '~/types';

type DialogRealtimeChannelOptions = {
  token?: string | null;
  dialogId?: string | null;
  type?: DialogType | null;
  role?: DialogMemberRole | null;
  messageId?: string | null;
};

export const getDialogRealtimeChannel = ({
  token,
  dialogId,
  type,
  role,
  messageId,
}: DialogRealtimeChannelOptions): string | null => {
  if (!token || !dialogId || (type === 'C' && role) || (type === 'D' && !role && !messageId)) {
    return null;
  }

  return `dialog.${dialogId}`;
};
