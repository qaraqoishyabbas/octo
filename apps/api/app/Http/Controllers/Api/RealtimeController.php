<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Enums\DialogType;
use App\Models\Dialog;
use App\Models\User;
use App\Support\DialogRealtime;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RealtimeController extends Controller {
  public function heartbeat(Request $request): JsonResponse {
    $me = $request->user();
    $lastSeenAt = now();

    $me->currentAccessToken()?->forceFill([
      'last_used_at' => $lastSeenAt,
    ])->save();

    $recipientIds = Dialog::query()
      ->whereHas('users', fn($query) => $query->whereKey($me->id))
      ->with(['users:id'])
      ->get()
      ->flatMap(fn(Dialog $dialog) => $dialog->users->pluck('id'))
      ->reject(fn($userId) => (string)$userId === (string)$me->id)
      ->unique()
      ->values()
      ->all();

    DialogRealtime::presence((string)$me->id, $lastSeenAt->toJSON(), $recipientIds);

    return response()->json([
      'ok' => true,
      'last_seen_at' => $lastSeenAt->toJSON(),
    ]);
  }

  public function typing(Request $request): JsonResponse {
    $validated = $request->validate([
      'dialog_id' => ['required', 'string'],
      'typing' => ['sometimes', 'boolean'],
    ]);
    $dialog = $this->findDialog($request->user(), $validated['dialog_id']);

    if (!$dialog) {
      return response()->json([
        'ok' => false,
        'message' => 'Dialog not found',
      ], 404);
    }

    if ($dialog->type === DialogType::CHANNEL) {
      return response()->json([
        'ok' => true,
      ]);
    }

    DialogRealtime::typing($dialog, [
      'id' => (string)$request->user()->id,
      'name' => $request->user()->name,
      'first_name' => $request->user()->first_name,
      'last_name' => $request->user()->last_name,
      'username' => $request->user()->username,
      'avatar' => $request->user()->avatar,
    ], (bool)($validated['typing'] ?? true));

    return response()->json([
      'ok' => true,
    ]);
  }

  private function findDialog(User $me, string $dialogId): ?Dialog {
    $parts = Dialog::parseDialogId($dialogId);

    if (!$parts) {
      return null;
    }

    $query = $me->dialogs()
      ->select(Dialog::columns())
      ->where('dialogs.type', $parts['type']);

    if ($parts['type'] === DialogType::DIRECT->value && $parts['id'] === $me->id) {
      $query->where(fn($directQuery) => $directQuery
        ->where('dialogs.id', $parts['id'])
        ->orWhereDoesntHave('users', fn($userQuery) => $userQuery
          ->where('users.id', '!=', $me->id)));
    } elseif ($parts['type'] === DialogType::DIRECT->value) {
      $query->where(fn($directQuery) => $directQuery
        ->where('dialogs.id', $parts['id'])
        ->orWhereHas('users', fn($userQuery) => $userQuery
          ->where('users.id', '!=', $me->id)
          ->where('users.id', $parts['id'])));
    } else {
      $query->where('dialogs.id', $parts['id']);
    }

    return $query->first();
  }
}
