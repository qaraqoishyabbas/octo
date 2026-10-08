<?php

namespace App\Http\Resources;

use App\Enums\DialogType;
use App\Support\DialogAccess;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DialogResource extends JsonResource {
  public function toArray(Request $request): array {
    $directUser = $this->directProfileUser($request);
    $isSelf = $this->isSelfDirect($request);

    return [
      'id' => $this->id,
      'dialog_id' => $directUser?->dialog_id ?? $this->dialog_id,
      'username' => $directUser?->username,
      'bio' => $directUser?->bio,
      'email' => $directUser?->email,
      'birth_date' => $directUser?->birth_date?->format('Y-m-d'),
      'author_id' => $directUser?->id ?? $this->author_id,
      'last_seen_at' => $directUser?->last_seen_at,
      'title' => $isSelf ? 'Избранное' : ($directUser?->name ?? $this->title),
      'description' => $this->description,
      'avatar' => $directUser?->avatar ?? $this->avatar,
      'type' => $this->type?->value,
      'users_count' => $this->users_count,
      'counter' => (int)($this->counter ?? 0),
      'first_unread_message_id' => $this->first_unread_message_id,
      'has_reminder' => (bool)($this->has_reminder ?? false),
      'last_read_at' => $this->pivot?->last_read_at,
      'can_view_members' => in_array($this->type?->value, [DialogType::GROUP->value, DialogType::CHANNEL->value], true),
      'is_self' => $isSelf,
      'message' => $this->whenLoaded('message', fn() => $this->message ? [
        'id' => $this->message->id,
        'dialog_id' => $this->message->dialog_id,
        'sender_id' => $this->message->sender_id,
        'message' => $this->message->message,
        'attachments' => $this->when(
          $this->message->relationLoaded('attachments'),
          fn() => $this->message->attachments->toArray(),
          [],
        ),
        'is_sender' => $this->message->is_sender,
        'created_at' => $this->message->created_at,
        'updated_at' => $this->message->updated_at,
        'sender' => $this->when(
          $this->message->relationLoaded('sender') && $this->message->sender,
          fn() => $this->message->sender->toArray()
        ),
      ] : null),
      'role' => $this->pivot?->role,
      'permissions' => DialogAccess::permissions($this->resource),
      'muted' => (bool)$this->pivot?->muted,
      'pinned' => (bool)$this->pivot?->pinned,
      'archived' => (bool)$this->pivot?->archived,
    ];
  }

  private function directProfileUser(Request $request): mixed {
    if ($this->type !== DialogType::DIRECT || !$this->relationLoaded('users')) {
      return null;
    }

    $userId = $request->user()?->id ?? auth()->id();

    return $this->users->firstWhere('id', '!=', $userId)
      ?? $this->users->firstWhere('id', $userId);
  }

  private function isSelfDirect(Request $request): bool {
    if ($this->type !== DialogType::DIRECT || !$this->relationLoaded('users')) {
      return false;
    }

    $userId = $request->user()?->id ?? auth()->id();

    return (bool)$userId
      && $this->users->count() === 1
      && $this->users->firstWhere('id', $userId) !== null;
  }
}
