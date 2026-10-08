<?php

namespace App\Enums;

enum DialogMemberRole: string {
  case OWNER = 'owner';
  case ADMIN = 'admin';
  case MEMBER = 'member';

  /**
   * @return list<string>
   */
  public static function values(): array {
    return array_map(static fn(self $role): string => $role->value, self::cases());
  }
}
