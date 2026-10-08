<?php

namespace App\Enums;

enum DialogPermission: string {
  case SEND_MESSAGES = 'send_messages';
  case PIN_MESSAGES = 'pin_messages';
  case DELETE_MESSAGES = 'delete_messages';
  case BAN_USERS = 'ban_users';
  case MANAGE_DIALOG = 'manage_dialog';
  case INVITE_USERS = 'invite_users';
  case MANAGE_ADMINS = 'manage_admins';

  /**
   * @return list<string>
   */
  public static function values(): array {
    return array_map(static fn(self $permission): string => $permission->value, self::cases());
  }

  /**
   * @return list<string>
   */
  public static function ownerDefaults(): array {
    return self::values();
  }

  /**
   * @return list<string>
   */
  public static function adminDefaults(): array {
    return [
      self::SEND_MESSAGES->value,
      self::PIN_MESSAGES->value,
      self::DELETE_MESSAGES->value,
      self::BAN_USERS->value,
      self::MANAGE_DIALOG->value,
      self::INVITE_USERS->value,
    ];
  }
}
