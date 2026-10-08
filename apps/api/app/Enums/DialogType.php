<?php

namespace App\Enums;

enum DialogType: string {
  case GROUP = 'G';
  case CHANNEL = 'C';
  case BOT = 'B';
  case DIRECT = 'D';

  /**
   * @return list<string>
   */
  public static function values(): array {
    return array_map(static fn(self $type): string => $type->value, self::cases());
  }
}
