<?php

namespace App\Services;

use App\Models\Dialog;
use App\Models\Message;
use App\Models\NotificationApp;
use Illuminate\Support\Facades\DB;

class MessagePushService {
  public function __construct(private NotificationService $notifications) {}

  public function send(Dialog $dialog, Message $message): void {
    $recipients = $dialog->users()
      ->where('users.id', '!=', $message->sender_id)
      ->with('notificationPreference')
      ->get(['users.id', 'users.username']);
    $eligible = $recipients
      ->filter(fn($user) => ($user->notificationPreference?->enabled ?? true)
        && (!$user->pivot->muted || (($user->notificationPreference?->mentions_in_muted ?? true)
          && $this->mentions($message->message, $user->id, $user->username))));
    $eligibleWeb = $recipients
      ->filter(fn($user) => !$user->pivot->muted
        || $this->mentions($message->message, $user->id, $user->username));
    $recipientIds = $recipients->pluck('id')->all();
    if ($recipientIds === []) {
      return;
    }

    $title = $dialog->title ?: ($message->sender?->name ?: 'Новое сообщение');
    $plainText = trim(html_entity_decode(strip_tags($message->message), ENT_QUOTES | ENT_HTML5));
    $body = mb_strimwidth($plainText ?: 'Вложение', 0, 180, '…');
    foreach (NotificationApp::query()->where('enabled', true)
      ->whereHas('pushTokens', fn($query) => $query->whereIn('user_id', $recipientIds))->cursor() as $app) {
      $webPush = $app->platform === 'web';
      foreach (($webPush ? $eligibleWeb : $eligible) as $recipient) {
        $badge = null;
        if ($webPush || ($recipient->notificationPreference?->badge ?? true)) {
          $badge = DB::table('messages')
            ->join('dialog_user', 'dialog_user.dialog_id', '=', 'messages.dialog_id')
            ->where('dialog_user.user_id', $recipient->id)
            ->whereNull('messages.deleted_at')
            ->where(fn($query) => $query->whereNull('messages.sender_id')
              ->orWhere('messages.sender_id', '!=', $recipient->id))
            ->where(fn($query) => $query->whereNull('dialog_user.last_read_at')
              ->orWhereColumn('messages.created_at', '>', 'dialog_user.last_read_at'))
            ->count();
        }
        $this->notifications->sendToUsers($app, [$recipient->id], $title, $body, [
          'dialog_id' => $dialog->dialog_id,
          'message_id' => $message->id,
          'url' => '/@' . $dialog->dialog_id . '?message=' . $message->id,
          'silent' => $message->silent || (!$webPush && !($recipient->notificationPreference?->sound ?? true)),
          'badge' => $badge,
          'muted' => (bool)$recipient->pivot->muted,
          'mentioned' => $this->mentions($message->message, $recipient->id, $recipient->username),
        ]);
      }
    }
  }

  private function mentions(string $message, string $userId, ?string $username): bool {
    foreach (['[@ id="', "[@ id='", 'data-id="', "data-id='"] as $prefix) {
      $quote = substr($prefix, -1);
      if (str_contains($message, $prefix . $userId . $quote)) {
        return true;
      }
    }
    return $username !== null && $username !== ''
      && preg_match('/(?<![\pL\pN_])@' . preg_quote($username, '/') . '(?![\pL\pN_])/iu', strip_tags($message)) === 1;
  }
}
