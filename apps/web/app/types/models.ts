export interface User {
  id: string;
  dialog_id: string;
  first_name: string;
  last_name: string;
  name: string;
  bio: string | null;
  email: string;
  username: string;
  birth_date: string | null;
  avatar: string | null;
  last_seen_at?: string | null;
  email_verified_at?: string | null;
  has_password?: boolean;
  dialog_role?: DialogMemberRole;
  dialog_permissions?: DialogPermission[];
  created_at: string;
  updated_at: string;
}

export type DialogType = 'G' | 'C' | 'B' | 'D';

export type DialogMemberRole = 'owner' | 'admin' | 'member';

export type DialogPermission =
  | 'send_messages'
  | 'pin_messages'
  | 'delete_messages'
  | 'ban_users'
  | 'manage_dialog'
  | 'invite_users'
  | 'manage_admins';

export type MessageAttachmentType = 'media' | 'file';

export interface MessageAttachment {
  id: string;
  message_id?: string;
  dialog_id?: string;
  uploader_id?: string | null;
  uploader?: User | null;
  type: MessageAttachmentType;
  mime_type: string;
  original_name: string;
  path: string;
  size: number;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
  thumbnail_path?: string | null;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
}

export interface MessageLink {
  id: string;
  message_id?: string;
  dialog_id?: string;
  sender_id?: string | null;
  sender?: User | null;
  url: string;
  title?: string | null;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ChatMessage {
  silent?: boolean;
  id: string;
  dialog_id: string;
  sender_id: string | null;
  reply_to_id?: string | null;
  message: string;
  pinned_at?: string | null;
  pinned_by_id?: string | null;
  attachments?: MessageAttachment[];
  links?: MessageLink[];
  is_sender: boolean;
  is_edited?: boolean;
  is_pinned?: boolean;
  created_at: string;
  updated_at: string;
  sender?: User | null;
  reply_to?: ChatMessage | null;
}

export type DialogMessage = ChatMessage;

export interface DialogPreview {
  id: string;
  dialog_id: string;
  username?: string | null;
  title: string | null;
  description: string | null;
  avatar: string | null;
  type: DialogType;
  users_count: number;
}

export interface Dialog {
  id: string;
  dialog_id: string;
  username?: string | null;
  bio?: string | null;
  email?: string | null;
  birth_date?: string | null;
  author_id: string | null;
  title: string | null;
  description: string | null;
  avatar: string | null;
  type: DialogType;
  users_count: number;
  counter?: number;
  first_unread_message_id?: string | null;
  has_reminder?: boolean;
  last_read_at?: string | null;
  last_seen_at?: string | null;
  can_view_members?: boolean;
  is_self?: boolean;
  message?: DialogMessage | null;
  role: DialogMemberRole;
  permissions: DialogPermission[];
  muted: boolean;
  pinned: boolean;
  archived: boolean;
}
