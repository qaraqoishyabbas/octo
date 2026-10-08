<?php

namespace App\Jobs;

use App\Models\NotificationDelivery;
use App\Services\PushProvider;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

class SendPushNotification implements ShouldQueue {
  use Queueable;

  public int $tries = 3;
  public int $backoff = 30;

  public function __construct(public string $deliveryId) {}

  public function handle(PushProvider $provider): void {
    $delivery = NotificationDelivery::query()->with(['app.credentials', 'pushToken.sessionToken'])->find($this->deliveryId);
    if (!$delivery || $delivery->status === 'sent') {
      return;
    }
    if (!$delivery->app?->enabled || !$delivery->pushToken || $delivery->pushToken->user_id !== $delivery->user_id) {
      $delivery->update(['status' => 'skipped', 'error_code' => 'token_unavailable']);
      return;
    }
    if ($delivery->pushToken->sessionToken?->expires_at?->isPast()) {
      $delivery->pushToken->delete();
      $delivery->update(['status' => 'skipped', 'error_code' => 'session_expired']);
      return;
    }

    try {
      $provider->send($delivery);
      $delivery->update(['status' => 'sent', 'sent_at' => now(), 'error_code' => null]);
    } catch (\App\Services\InvalidPushToken $e) {
      $delivery->pushToken->delete();
      $delivery->update(['status' => 'failed', 'error_code' => 'invalid_token']);
    }
  }

  public function failed(?Throwable $exception): void {
    NotificationDelivery::query()->whereKey($this->deliveryId)
      ->where('status', 'queued')
      ->update(['status' => 'failed', 'error_code' => 'provider_error']);
  }
}
