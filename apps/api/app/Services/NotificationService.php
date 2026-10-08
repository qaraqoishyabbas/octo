<?php

namespace App\Services;

use App\Jobs\SendPushNotification;
use App\Models\NotificationApp;
use App\Models\NotificationDelivery;
use Throwable;

class NotificationService {
  public static function providersFor(string $platform): array {
    return match ($platform) {
      'web' => ['webpush'],
      'android' => ['fcm'],
      'ios' => ['apns', 'fcm'],
      'desktopapp' => ['webpush'],
      default => [],
    };
  }

  public static function credentialFieldsFor(string $provider): array {
    return match ($provider) {
      'webpush' => ['subject', 'public_key', 'private_key'],
      'fcm' => ['project_id', 'client_email', 'private_key'],
      'apns' => ['team_id', 'key_id', 'bundle_id', 'private_key'],
      default => [],
    };
  }

  public function sendToUsers(NotificationApp $app, array $userIds, string $title, string $body, array $data = []): int {
    if (!$app->enabled) {
      return 0;
    }
    $count = 0;
    foreach ($app->pushTokens()->whereIn('user_id', array_unique($userIds))
      ->with('user.notificationPreference')->cursor() as $token) {
      $preference = $app->platform === 'web'
        ? null : $token->user?->notificationPreference;
      if ($preference?->enabled === false) {
        continue;
      }
      $payload = $data;
      if ($preference?->sound === false) {
        $payload['silent'] = true;
      }
      if ($preference?->badge === false) {
        unset($payload['badge']);
      }
      $delivery = NotificationDelivery::query()->create([
        'notification_app_id' => $app->id,
        'push_token_id' => $token->id,
        'user_id' => $token->user_id,
        'status' => 'queued',
        'title' => $preference?->show_names === false ? 'Новое уведомление' : $title,
        'body' => $preference?->show_text === false ? 'Содержимое скрыто' : $body,
        'data' => $payload,
      ]);
      try {
        SendPushNotification::dispatch($delivery->id)->afterCommit();
        $count++;
      } catch (Throwable) {
        // A synchronous queue must not turn an optional push failure into a failed chat message.
        $delivery->update(['status' => 'failed', 'error_code' => 'dispatch_error']);
      }
    }
    return $count;
  }
}
