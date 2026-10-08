<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class DialogRealtimeEvent implements ShouldBroadcastNow {
  use Dispatchable;
  use InteractsWithSockets;
  use SerializesModels;

  /**
   * @param array<int, string> $recipientIds
   * @param array<string, mixed> $payload
   * @param array<int, string> $privateChannels
   */
  public function __construct(
    private readonly string $name,
    private readonly array  $recipientIds,
    private readonly array  $payload,
    private readonly array  $privateChannels = [],
  ) {
  }

  public function broadcastAs(): string {
    return $this->name;
  }

  /**
   * @return array<int, PrivateChannel>
   */
  public function broadcastOn(): array {
    return collect($this->recipientIds)
      ->map(fn(string $userId) => "user.{$userId}")
      ->merge($this->privateChannels)
      ->unique()
      ->map(fn(string $channel) => new PrivateChannel($channel))
      ->all();
  }

  /**
   * @return array<string, mixed>
   */
  public function broadcastWith(): array {
    return $this->payload;
  }
}
