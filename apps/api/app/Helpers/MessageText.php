<?php

namespace App\Helpers;

use App\Models\User;

class MessageText {
  public static function mention(User $user): string {
    $userId = trim((string)$user->id);
    $label = trim((string)$user->name) ?: trim((string)$user->username);

    if ($userId === '') {
      return $label ?: 'Пользователь';
    }

    return sprintf(
      '[@ id="%s" label="%s"]',
      self::escapeAttribute($userId),
      self::escapeAttribute($label),
    );
  }

  public static function mentions(iterable $users): string {
    $mentions = [];

    foreach ($users as $user) {
      if ($user instanceof User) {
        $mentions[] = self::mention($user);
      }
    }

    return implode(', ', $mentions);
  }

  public static function paragraph(string $message): string {
    return $message;
  }

  private static function escapeAttribute(string $value): string {
    return str_replace(['\\', '"'], ['\\\\', '\\"'], $value);
  }
}
