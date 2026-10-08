<?php

namespace App\Support;

use App\Enums\DialogType;
use App\Events\DialogRealtimeEvent;
use App\Models\Dialog;
use App\Models\Message;
use Throwable;

class DialogRealtime {
  /**
   * @param array<int, string|null> $extraUserIds
   * @return array<int, string>
   */
  public static function dialogUserIds(Dialog $dialog, array $extraUserIds = []): array {
    return collect($extraUserIds)
      ->merge($dialog->users()->pluck('users.id'))
      ->filter()
      ->map(fn($userId) => (string)$userId)
      ->unique()
      ->values()
      ->all();
  }

  /**
   * @param array<int, string|null> $extraUserIds
   */
  public static function message(string $event, Dialog $dialog, Message $message, array $extraUserIds = []): void {
    $message->loadMissing(self::messageRelations());

    self::broadcastEvent(new DialogRealtimeEvent($event, self::dialogUserIds($dialog, $extraUserIds), [
      'dialog_id' => (string)$dialog->id,
      'dialog_public_id' => $dialog->dialog_id,
      'message' => $message->toArray(),
    ], self::publicDialogChannels($dialog)));
  }

  /**
   * @param array<int, string|null> $extraUserIds
   */
  public static function messageDeleted(Dialog $dialog, string $messageId, array $extraUserIds = []): void {
    self::broadcastEvent(new DialogRealtimeEvent('dialog.message.deleted', self::dialogUserIds($dialog, $extraUserIds), [
      'dialog_id' => (string)$dialog->id,
      'dialog_public_id' => $dialog->dialog_id,
      'message_id' => $messageId,
    ], self::publicDialogChannels($dialog)));
  }

  /**
   * @param array<int, string|null> $extraUserIds
   */
  public static function membership(
    Dialog   $dialog,
    string   $action,
    string   $userId,
    ?Message $message = null,
    array    $extraUserIds = [],
  ): void {
    if ($message) {
      $message->loadMissing(self::messageRelations());
    }

    self::broadcastEvent(new DialogRealtimeEvent('dialog.membership.changed', self::dialogUserIds($dialog, $extraUserIds), [
      'dialog_id' => (string)$dialog->id,
      'dialog_public_id' => $dialog->dialog_id,
      'action' => $action,
      'user_id' => $userId,
      'message' => $message?->toArray(),
    ], self::publicDialogChannels($dialog)));
  }

  /**
   * @param array<int, string|null> $recipientIds
   */
  public static function presence(string $userId, ?string $lastSeenAt, array $recipientIds): void {
    self::broadcastEvent(new DialogRealtimeEvent('user.presence.updated', self::normalizeUserIds($recipientIds), [
      'user_id' => $userId,
      'last_seen_at' => $lastSeenAt,
    ]));
  }

  /**
   * @param array<string, mixed> $user
   */
  public static function typing(Dialog $dialog, array $user, bool $typing = true): void {
    $recipientIds = self::dialogUserIds($dialog);
    $actorId = (string)($user['id'] ?? '');

    self::broadcastEvent(new DialogRealtimeEvent(
      'dialog.typing',
      array_values(array_filter($recipientIds, fn(string $userId) => $userId !== $actorId)),
      [
        'dialog_id' => (string)$dialog->id,
        'dialog_public_id' => $dialog->dialog_id,
        'typing' => $typing,
        'user' => $user,
      ],
    ));
  }

  /**
   * @return array<int, mixed>
   */
  private static function messageRelations(): array {
    return [
      'attachments',
      'links',
      'sender' => fn($query) => $query->withLastSeenAt(),
      'replyTo',
      'replyTo.attachments',
      'replyTo.links',
      'replyTo.sender' => fn($query) => $query->withLastSeenAt(),
    ];
  }

  /**
   * @param array<int, string|null> $userIds
   * @return array<int, string>
   */
  private static function normalizeUserIds(array $userIds): array {
    return collect($userIds)
      ->filter()
      ->map(fn($userId) => (string)$userId)
      ->unique()
      ->values()
      ->all();
  }

  /**
   * @return array<int, string>
   */
  private static function publicDialogChannels(Dialog $dialog): array {
    return $dialog->type === DialogType::CHANNEL
      ? ["dialog.{$dialog->dialog_id}"]
      : [];
  }

  private static function broadcastEvent(DialogRealtimeEvent $event): void {
    try {
      broadcast($event);
    } catch (Throwable $exception) {
      report($exception);
    }
  }
}
