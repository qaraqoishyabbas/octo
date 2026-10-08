<?php

namespace App\Http\Controllers\Api;

use App\Enums\DialogMemberRole;
use App\Enums\DialogType;
use App\Helpers\MessageText;
use App\Http\Controllers\Controller;
use App\Models\Dialog;
use App\Models\Message;
use App\Models\TemporaryUpload;
use App\Models\User;
use App\Rules\TemporaryFileExists;
use App\Support\DialogRealtime;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class GroupController extends Controller {
  public function store(Request $request): JsonResponse {
    $validated = $request->validate([
      'title' => ['required', 'string', 'max:70'],

      'users' => ['nullable', 'array', 'min:1'],
      'users.*' => ['uuid', 'exists:users,id', 'distinct'],

      'avatar' => [
        'nullable',
        'string',
        'regex:/^avatars\/[0-9a-f-]{36}\.[a-z]+$/i',
        new TemporaryFileExists,
      ],
    ]);

    /** @var User $me */
    $me = $request->user();

    $userIds = User::query()
      ->whereIn('id', $validated['users'] ?? [])
      ->pluck('id')
      ->push($me->id)
      ->unique()
      ->values();

    $addedUserIdsForRealtime = [];
    $addedMessage = null;

    $dialog = DB::transaction(function () use ($me, $validated, $userIds, &$addedUserIdsForRealtime, &$addedMessage): Dialog {
      $dialog = Dialog::query()->create([
        'author_id' => $me->id,
        'title' => $validated['title'],
        'description' => null,
        'avatar' => $validated['avatar'] ?? null,
        'type' => DialogType::GROUP,
      ]);

      $creationMessage = Message::query()->create([
        'dialog_id' => $dialog->id,
        'sender_id' => null,
        'message' => 'Группа создана',
      ]);

      $dialog->users()->sync(
        $userIds->mapWithKeys(fn($userId) => [
          $userId => [
            'role' => $userId === $me->id ? DialogMemberRole::OWNER->value : DialogMemberRole::MEMBER->value,
            'last_read_at' => $userId === $me->id ? $creationMessage->created_at : null,
          ],
        ])->all()
      );

      $addedUserIds = $userIds->reject(fn($userId) => $userId === $me->id)->values();

      if ($addedUserIds->isNotEmpty()) {
        $addedUsers = User::query()
          ->whereIn('id', $addedUserIds)
          ->get(['id', 'first_name', 'last_name', 'username']);
        $mentions = MessageText::mentions($addedUsers);
        $actorMention = MessageText::mention($me);

        $addedMessage = Message::query()->create([
          'dialog_id' => $dialog->id,
          'sender_id' => null,
          'message' => MessageText::paragraph($mentions
            ? "{$actorMention} добавил участников: {$mentions}"
            : "{$actorMention} добавил новых участников"),
        ]);

        $dialog->users()->updateExistingPivot($me->id, [
          'last_read_at' => $addedMessage->created_at,
        ]);
        $addedUserIdsForRealtime = $addedUserIds->map(fn($userId) => (string)$userId)->all();
      }

      if (!empty($validated['avatar'])) {
        TemporaryUpload::query()->where('path', $validated['avatar'])->delete();
      }

      return $dialog;
    });

    foreach ($addedUserIdsForRealtime as $userId) {
      DialogRealtime::membership($dialog, 'added', $userId, $addedMessage, [$userId]);
    }

    return response()->json([
      'ok' => true,
      'data' => $dialog->dialog_id,
    ]);
  }
}
