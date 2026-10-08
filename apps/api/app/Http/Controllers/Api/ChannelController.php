<?php

namespace App\Http\Controllers\Api;

use App\Enums\DialogMemberRole;
use App\Enums\DialogType;
use App\Http\Controllers\Controller;
use App\Http\Resources\DialogResource;
use App\Models\Dialog;
use App\Models\Message;
use App\Models\TemporaryUpload;
use App\Models\User;
use App\Rules\TemporaryFileExists;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ChannelController extends Controller {
  public function index(Request $request): JsonResponse {
    $perPage = min(100, max(1, (int)$request->query('per_page', 30)));
    $page = max(1, (int)$request->query('page', 1));
    $q = trim((string)$request->query('q', ''));

    $query = Dialog::query()
      ->select(Dialog::columns())
      ->where('dialogs.type', DialogType::CHANNEL)
      ->withCount('users');

    if ($q !== '') {
      $query->where('dialogs.title', 'like', "%{$q}%");
    }

    $total = (clone $query)->count();

    $channels = $query
      ->orderByDesc('users_count')
      ->orderBy('dialogs.title')
      ->orderBy('dialogs.id')
      ->forPage($page, $perPage)
      ->get()
      ->values();

    return response()->json([
      'ok' => true,
      'channels' => DialogResource::collection($channels)->resolve($request),
      'has_more' => ($page * $perPage) < $total,
      'total' => $total,
    ]);
  }

  public function store(Request $request): JsonResponse {
    $validated = $request->validate([
      'title' => ['required', 'string', 'max:70'],
      'description' => ['nullable', 'string', 'max:1000'],

      'avatar' => [
        'nullable',
        'string',
        'regex:/^avatars\/[0-9a-f-]{36}\.[a-z]+$/i',
        new TemporaryFileExists,
      ],
    ]);

    /** @var User $me */
    $me = $request->user();

    $dialog = DB::transaction(function () use ($me, $validated): Dialog {
      $dialog = Dialog::query()->create([
        'author_id' => $me->id,
        'title' => $validated['title'],
        'description' => $validated['description'] ?? null,
        'avatar' => $validated['avatar'] ?? null,
        'type' => DialogType::CHANNEL,
      ]);

      $message = Message::query()->create([
        'dialog_id' => $dialog->id,
        'sender_id' => null,
        'message' => 'Канал создан',
      ]);

      $dialog->users()->sync([
        $me->id => [
          'role' => DialogMemberRole::OWNER->value,
          'last_read_at' => $message->created_at,
        ],
      ]);

      if (!empty($validated['avatar'])) {
        TemporaryUpload::query()->where('path', $validated['avatar'])->delete();
      }

      return $dialog;
    });

    return response()->json([
      'ok' => true,
      'data' => $dialog->dialog_id,
    ]);
  }
}
