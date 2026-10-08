<?php

namespace App\Http\Controllers\Api;

use App\Enums\DialogMemberRole;
use App\Enums\DialogPermission;
use App\Enums\DialogType;
use App\Helpers\MessageText;
use App\Http\Controllers\Controller;
use App\Http\Resources\DialogResource;
use App\Models\Dialog;
use App\Models\Message;
use App\Models\MessageAttachment;
use App\Models\MessageLink;
use App\Models\TemporaryUpload;
use App\Models\User;
use App\Support\DialogAccess;
use App\Support\DialogRealtime;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class DialogController extends Controller {
  public function index(Request $request): JsonResponse {
    $me = $request->user();

    $dialogs = $this->dialogsQuery($me)
      ->get()
      ->values();

    return response()->json([
      'ok' => true,
      'dialogs' => DialogResource::collection($dialogs)->resolve($request),
      'total' => $dialogs->count(),
    ]);
  }

  public function show(Request $request, string $target): JsonResponse {
    $me = $request->user();

    $dialog = $this->findDialogByTarget($me, $target);

    if (!$dialog) {
      $dialog = $this->previewDialog($me, $target);

      if (!$dialog) {
        return response()->json([
          'ok' => false,
          'message' => 'Dialog not found',
        ], 404);
      }
    }

    return response()->json([
      'ok' => true,
      'dialog' => (new DialogResource($dialog))->resolve($request),
    ]);
  }

  public function groups(Request $request, string $target): JsonResponse {
    $me = $request->user();
    $dialog = $this->findDialogByTarget($me, $target) ?? $this->previewDialog($me, $target);

    if (!$dialog || $dialog->type !== DialogType::DIRECT || !$dialog->relationLoaded('users')) {
      return response()->json([
        'ok' => false,
        'message' => 'Dialog not found',
      ], 404);
    }

    return response()->json([
      'ok' => true,
      'groups' => $this->commonGroups($dialog, $me)->map(fn($group) => [
        'id' => $group->id,
        'dialog_id' => $group->dialog_id,
        'title' => $group->title,
        'description' => $group->description,
        'avatar' => $group->avatar,
        'type' => $group->type?->value,
        'users_count' => $group->users_count,
      ])->values(),
    ]);
  }

  public function attachments(Request $request, string $target): JsonResponse {
    $me = $request->user();
    $dialog = $this->findReadableDialogByTarget($me, $target);

    if (!$dialog) {
      return response()->json([
        'ok' => false,
        'message' => 'Dialog not found',
      ], 404);
    }

    $type = (string)$request->query('type', 'media');
    $perPage = min(100, max(1, (int)$request->query('per_page', (int)$request->query('limit', 60))));
    $page = max(1, (int)$request->query('page', 1));

    $query = MessageAttachment::query()
      ->with(['uploader:id,first_name,last_name,username,avatar'])
      ->whereHas('message')
      ->where('dialog_id', $dialog->id)
      ->orderByDesc('created_at')
      ->orderByDesc('id');

    if ($type === 'files' || $type === 'file') {
      $query->where('type', 'file');
    } elseif ($type === 'media') {
      $query->where('type', 'media');
    }

    $attachments = $query
      ->skip(($page - 1) * $perPage)
      ->limit($perPage + 1)
      ->get();
    $hasMore = $attachments->count() > $perPage;
    $items = $attachments->take($perPage)->values();

    return response()->json([
      'ok' => true,
      'attachments' => $items,
      'has_more' => $hasMore,
      'total' => $items->count(),
    ]);
  }

  public function links(Request $request, string $target): JsonResponse {
    $me = $request->user();
    $dialog = $this->findReadableDialogByTarget($me, $target);

    if (!$dialog) {
      return response()->json([
        'ok' => false,
        'message' => 'Dialog not found',
      ], 404);
    }

    $perPage = min(100, max(1, (int)$request->query('per_page', (int)$request->query('limit', 60))));
    $page = max(1, (int)$request->query('page', 1));

    $query = MessageLink::query()
      ->with(['sender:id,first_name,last_name,username,avatar'])
      ->whereHas('message')
      ->where('dialog_id', $dialog->id)
      ->orderByDesc('created_at')
      ->orderByDesc('id');

    $links = $query
      ->skip(($page - 1) * $perPage)
      ->limit($perPage + 1)
      ->get();
    $hasMore = $links->count() > $perPage;
    $items = $links->take($perPage)->values();

    return response()->json([
      'ok' => true,
      'links' => $items,
      'has_more' => $hasMore,
      'total' => $items->count(),
    ]);
  }

  public function users(Request $request, string $target): JsonResponse {
    $me = $request->user();
    $perPage = min(100, max(1, (int)$request->query('per_page', 30)));
    $page = max(1, (int)$request->query('page', 1));
    $role = $request->query('role');
    $roles = collect((array)$request->query('roles', []))
      ->flatMap(fn($role) => is_string($role) ? explode(',', $role) : [])
      ->map(fn($role) => trim($role))
      ->push($role)
      ->filter(fn($role) => is_string($role) && in_array($role, DialogMemberRole::values(), true))
      ->unique()
      ->values();
    $dialog = $this->findDialogMembershipByTarget($me, $target) ?? $this->channelPreviewDialog($target);

    if (!$dialog || !in_array($dialog->type?->value, [DialogType::GROUP->value, DialogType::CHANNEL->value], true)) {
      return response()->json([
        'ok' => false,
        'message' => 'Dialog not found',
      ], 404);
    }

    $query = $dialog->users()
      ->select(['users.id', 'users.first_name', 'users.last_name', 'users.bio', 'users.email', 'users.username', 'users.avatar', 'users.birth_date', 'users.created_at', 'users.updated_at'])
      ->withLastSeenAt()
      ->when(
        $roles->isNotEmpty(),
        fn($query) => $query->whereIn('dialog_user.role', $roles->all())
      )
      ->orderByRaw("CASE dialog_user.role WHEN 'owner' THEN 0 ELSE 1 END")
      ->orderByDesc('tokens_max_last_used_at')
      ->orderBy('users.first_name')
      ->orderBy('users.last_name');

    $total = (clone $query)->count();
    $users = $query
      ->forPage($page, $perPage)
      ->get()
      ->map(function (User $user) use ($dialog) {
        return [
          ...$user->toArray(),
          'dialog_role' => $user->pivot?->role,
          'dialog_permissions' => DialogAccess::permissionsFor(
            $user->pivot?->role,
            $dialog->type,
            $user->pivot?->permissions,
          ),
        ];
      })
      ->values();

    return response()->json([
      'ok' => true,
      'users' => $users,
      'has_more' => ($page * $perPage) < $total,
      'total' => $total,
    ]);
  }

  public function addUsers(Request $request, string $target): JsonResponse {
    $me = $request->user();
    $validated = $request->validate([
      'users' => ['required', 'array', 'min:1'],
      'users.*' => ['uuid', 'exists:users,id', 'distinct'],
    ]);
    $dialog = $this->findDialogMembershipByTarget($me, $target);

    if (!$dialog || $dialog->type !== DialogType::GROUP) {
      return response()->json([
        'ok' => false,
        'message' => 'Dialog not found',
      ], 404);
    }

    if (!DialogAccess::allows($dialog, DialogPermission::INVITE_USERS)) {
      return response()->json([
        'ok' => false,
        'message' => 'Forbidden',
      ], 403);
    }

    $userIds = User::query()
      ->whereIn('id', $validated['users'])
      ->whereKeyNot($me->id)
      ->pluck('id');
    $existingUserIds = $dialog->users()->whereIn('users.id', $userIds)->pluck('users.id');
    $newUserIds = $userIds->diff($existingUserIds)->values();
    $message = null;

    if ($newUserIds->isNotEmpty()) {
      $newUsers = User::query()
        ->whereIn('id', $newUserIds)
        ->get(['id', 'first_name', 'last_name', 'username']);
      $mentions = MessageText::mentions($newUsers);
      $actorMention = MessageText::mention($me);

      $message = Message::query()->create([
        'dialog_id' => $dialog->id,
        'sender_id' => null,
        'message' => MessageText::paragraph($mentions
          ? "{$actorMention} добавил участников: {$mentions}"
          : "{$actorMention} добавил новых участников"),
      ]);

      $dialog->users()->syncWithoutDetaching(
        $newUserIds->mapWithKeys(fn($userId) => [
          $userId => [
            'role' => DialogMemberRole::MEMBER->value,
            'last_read_at' => $message->created_at,
          ],
        ])->all()
      );

      foreach ($newUserIds as $newUserId) {
        DialogRealtime::membership($dialog, 'added', (string)$newUserId, $message, [(string)$newUserId]);
      }
    }

    return response()->json([
      'ok' => true,
      'added' => $newUserIds->count(),
      'users_count' => $dialog->users()->count(),
      'message' => $message,
    ]);
  }

  public function update(Request $request, string $target): JsonResponse {
    $me = $request->user();
    $dialog = $this->findDialogMembershipByTarget($me, $target);

    if (!$dialog || !in_array($dialog->type?->value, [DialogType::GROUP->value, DialogType::CHANNEL->value], true)) {
      return response()->json([
        'ok' => false,
        'message' => 'Dialog not found',
      ], 404);
    }

    if (!DialogAccess::allows($dialog, DialogPermission::MANAGE_DIALOG)) {
      return response()->json([
        'ok' => false,
        'message' => 'Forbidden',
      ], 403);
    }

    $validated = $request->validate([
      'title' => ['required', 'string', 'max:70'],
      'description' => ['nullable', 'string', 'max:1000'],
      'avatar' => [
        'nullable',
        'string',
        'regex:/^avatars\/[0-9a-f-]{36}\.[a-z]+$/i',
      ],
    ]);
    $avatar = $validated['avatar'] ?? null;
    $originalAvatar = $dialog->avatar;

    if ($avatar && $avatar !== $originalAvatar && !TemporaryUpload::query()->where('path', $avatar)->exists()) {
      throw ValidationException::withMessages([
        'avatar' => __('validation.exists', ['attribute' => 'avatar']),
      ]);
    }

    $dialog->forceFill([
      'title' => trim($validated['title']),
      'description' => filled($validated['description'] ?? null) ? trim($validated['description']) : null,
      'avatar' => $avatar,
    ])->save();

    if ($avatar && $avatar !== $originalAvatar) {
      TemporaryUpload::query()->where('path', $avatar)->delete();
    }

    $dialog->loadCount('users');
    $dialog->setRelation('message', null);

    return response()->json([
      'ok' => true,
      'dialog' => (new DialogResource($dialog))->resolve($request),
    ]);
  }

  public function inviteLink(Request $request, string $target): JsonResponse {
    $me = $request->user();
    $dialog = $this->findDialogMembershipByTarget($me, $target);

    if (!$dialog || !in_array($dialog->type?->value, [DialogType::GROUP->value, DialogType::CHANNEL->value], true)) {
      return response()->json([
        'ok' => false,
        'message' => 'Dialog not found',
      ], 404);
    }

    if (!DialogAccess::allows($dialog, DialogPermission::INVITE_USERS)) {
      return response()->json([
        'ok' => false,
        'message' => 'Forbidden',
      ], 403);
    }

    if (!$dialog->invite_token) {
      do {
        $token = substr(str_replace('-', '', (string)Str::uuid()), 0, 16);
      } while (Dialog::query()->where('invite_token', $token)->exists());

      $dialog->forceFill(['invite_token' => $token])->save();
    }

    return response()->json([
      'ok' => true,
      'token' => $dialog->invite_token,
    ]);
  }

  public function invite(Request $request, string $token): JsonResponse {
    $me = $request->user();
    $dialog = Dialog::query()
      ->select(Dialog::columns())
      ->withCount('users')
      ->where('invite_token', $token)
      ->whereIn('type', [DialogType::GROUP->value, DialogType::CHANNEL->value])
      ->first();

    if (!$dialog) {
      return response()->json([
        'ok' => false,
        'message' => 'Invite not found',
      ], 404);
    }

    return response()->json([
      'ok' => true,
      'dialog' => [
        'dialog_id' => $dialog->dialog_id,
        'title' => $dialog->title,
        'description' => $dialog->description,
        'avatar' => $dialog->avatar,
        'type' => $dialog->type?->value,
        'users_count' => $dialog->users_count,
        'is_member' => $dialog->users()->whereKey($me->id)->exists(),
      ],
    ]);
  }

  public function joinByInvite(Request $request, string $token): JsonResponse {
    $me = $request->user();
    $message = null;
    $dialog = Dialog::query()
      ->select(Dialog::columns())
      ->where('invite_token', $token)
      ->whereIn('type', [DialogType::GROUP->value, DialogType::CHANNEL->value])
      ->first();

    if (!$dialog) {
      return response()->json([
        'ok' => false,
        'message' => 'Invite not found',
      ], 404);
    }

    $existingMember = $dialog->users()->whereKey($me->id)->first();

    if (!$existingMember) {
      $lastReadAt = $dialog->messages()->max('created_at');

      if ($dialog->type === DialogType::GROUP) {
        $message = Message::query()->create([
          'dialog_id' => $dialog->id,
          'sender_id' => null,
          'message' => MessageText::paragraph(MessageText::mention($me) . ' присоединился по ссылке приглашения'),
        ]);
        $lastReadAt = $message->created_at;
      }

      $dialog->users()->attach($me->id, [
        'role' => DialogMemberRole::MEMBER->value,
        'permissions' => null,
        'last_read_at' => $lastReadAt,
      ]);

      DialogRealtime::membership($dialog, 'joined', (string)$me->id, $message, [(string)$me->id]);
    }

    return response()->json([
      'ok' => true,
      'dialog_id' => $dialog->dialog_id,
      'joined' => !$existingMember,
    ]);
  }

  public function join(Request $request, string $target): JsonResponse {
    $me = $request->user();
    $dialog = $this->channelPreviewDialog($target);

    if (!$dialog) {
      return response()->json([
        'ok' => false,
        'message' => 'Dialog not found',
      ], 404);
    }

    $existingMember = $dialog->users()->whereKey($me->id)->exists();

    if (!$existingMember) {
      $dialog->users()->attach($me->id, [
        'role' => DialogMemberRole::MEMBER->value,
        'permissions' => null,
        'last_read_at' => $dialog->messages()->max('created_at'),
      ]);

      DialogRealtime::membership($dialog, 'joined', (string)$me->id, null, [(string)$me->id]);
    }

    return response()->json([
      'ok' => true,
      'dialog_id' => $dialog->dialog_id,
      'joined' => !$existingMember,
      'users_count' => $dialog->users()->count(),
    ]);
  }

  public function updateUserRole(Request $request, string $target, User $user): JsonResponse {
    $me = $request->user();
    $validated = $request->validate([
      'role' => ['required', 'in:' . implode(',', [
          DialogMemberRole::ADMIN->value,
          DialogMemberRole::MEMBER->value,
        ])],
      'permissions' => ['sometimes', 'array'],
      'permissions.*' => ['required', 'string', 'in:' . implode(',', DialogPermission::values())],
    ]);
    $dialog = $this->findDialogMembershipByTarget($me, $target);

    if (!$dialog || !in_array($dialog->type?->value, [DialogType::GROUP->value, DialogType::CHANNEL->value], true)) {
      return response()->json([
        'ok' => false,
        'message' => 'Dialog not found',
      ], 404);
    }

    if (!DialogAccess::allows($dialog, DialogPermission::MANAGE_ADMINS)) {
      return response()->json([
        'ok' => false,
        'message' => 'Forbidden',
      ], 403);
    }

    $member = $dialog->users()->whereKey($user->id)->first();

    if (!$member) {
      return response()->json([
        'ok' => false,
        'message' => 'User not found in dialog',
      ], 404);
    }

    if ($member->pivot?->role === DialogMemberRole::OWNER->value) {
      return response()->json([
        'ok' => false,
        'message' => 'Owner role cannot be changed',
      ], 422);
    }

    $permissions = $validated['role'] === DialogMemberRole::ADMIN->value
      ? collect($validated['permissions'] ?? DialogPermission::adminDefaults())->unique()->values()->all()
      : null;
    $encodedPermissions = $validated['role'] === DialogMemberRole::ADMIN->value
      ? json_encode($permissions)
      : null;

    $dialog->users()->updateExistingPivot($user->id, [
      'role' => $validated['role'],
      'permissions' => $encodedPermissions,
    ]);

    return response()->json([
      'ok' => true,
      'user_id' => $user->id,
      'role' => $validated['role'],
      'permissions' => $permissions ?? [],
    ]);
  }

  public function removeUser(Request $request, string $target, User $user): JsonResponse {
    $me = $request->user();
    $dialog = $this->findDialogMembershipByTarget($me, $target);

    if (!$dialog || $dialog->type !== DialogType::GROUP) {
      return response()->json([
        'ok' => false,
        'message' => 'Dialog not found',
      ], 404);
    }

    if (!DialogAccess::allows($dialog, DialogPermission::BAN_USERS)) {
      return response()->json([
        'ok' => false,
        'message' => 'Forbidden',
      ], 403);
    }

    $member = $dialog->users()->whereKey($user->id)->first();

    if (!$member) {
      return response()->json([
        'ok' => false,
        'message' => 'User not found in dialog',
      ], 404);
    }

    $memberRole = $member->pivot?->role;

    if ($memberRole === DialogMemberRole::OWNER->value) {
      return response()->json([
        'ok' => false,
        'message' => 'Owner cannot be removed',
      ], 422);
    }

    if ($dialog->pivot?->role === DialogMemberRole::ADMIN->value && $memberRole !== DialogMemberRole::MEMBER->value) {
      return response()->json([
        'ok' => false,
        'message' => 'Forbidden',
      ], 403);
    }

    $dialog->users()->detach($user->id);

    $message = Message::query()->create([
      'dialog_id' => $dialog->id,
      'sender_id' => null,
      'message' => MessageText::paragraph(
        MessageText::mention($me) . ' исключил участника: ' . MessageText::mention($user),
      ),
    ]);

    DialogRealtime::membership($dialog, 'removed', (string)$user->id, $message, [(string)$user->id]);

    return response()->json([
      'ok' => true,
      'removed' => true,
      'user_id' => $user->id,
      'users_count' => $dialog->users()->count(),
      'message' => $message,
    ]);
  }

  public function leave(Request $request, string $target): JsonResponse {
    $me = $request->user();
    $dialog = $this->findDialogMembershipByTarget($me, $target);

    if (!$dialog || !in_array($dialog->type?->value, [DialogType::GROUP->value, DialogType::CHANNEL->value], true)) {
      return response()->json([
        'ok' => false,
        'message' => 'Dialog not found',
      ], 404);
    }

    if ($dialog->pivot?->role === DialogMemberRole::OWNER->value) {
      return response()->json([
        'ok' => false,
        'message' => 'Owner cannot leave dialog',
      ], 422);
    }

    $dialog->users()->detach($me->id);

    $message = null;
    if ($dialog->type === DialogType::GROUP) {
      $message = Message::query()->create([
        'dialog_id' => $dialog->id,
        'sender_id' => null,
        'message' => MessageText::paragraph(MessageText::mention($me) . ' вышел из группы'),
      ]);
    }

    DialogRealtime::membership($dialog, 'left', (string)$me->id, $message, [(string)$me->id]);

    return response()->json([
      'ok' => true,
      'left' => true,
      'dialog_id' => $dialog->dialog_id,
      'users_count' => $dialog->users()->count(),
      'message' => $message,
    ]);
  }

  public function mute(Request $request, string $target): JsonResponse {
    return $this->updatePivotFlag($request, $target, 'muted');
  }

  public function pin(Request $request, string $target): JsonResponse {
    return $this->updatePivotFlag($request, $target, 'pinned');
  }

  public function archive(Request $request, string $target): JsonResponse {
    return $this->updatePivotFlag($request, $target, 'archived');
  }

  public function read(Request $request, string $target): JsonResponse {
    $me = $request->user();
    $validated = $request->validate([
      'message_id' => ['nullable', 'string'],
    ]);
    $dialog = $this->findDialogByTarget($me, $target);

    if (!$dialog) {
      return response()->json([
        'ok' => false,
        'message' => 'Dialog not found',
      ], 404);
    }

    $messageId = $validated['message_id'] ?? null;
    $message = $messageId
      ? $dialog->messages()->whereKey($messageId)->first()
      : null;

    if ($messageId && !$message) {
      return response()->json([
        'ok' => false,
        'message' => 'Message not found',
      ], 404);
    }

    $readAt = Carbon::parse(
      $message?->created_at ?? $dialog->messages()->max('created_at') ?? now()
    );
    $currentReadAt = $dialog->pivot?->last_read_at
      ? Carbon::parse($dialog->pivot->last_read_at)
      : null;

    if ($currentReadAt && $currentReadAt->greaterThan($readAt)) {
      $readAt = $currentReadAt;
    }

    $me->dialogs()->updateExistingPivot($dialog->id, [
      'last_read_at' => $readAt,
    ]);

    $counter = $dialog->messages()
      ->where(fn($senderQuery) => $senderQuery
        ->whereNull('messages.sender_id')
        ->orWhere('messages.sender_id', '!=', $me->id))
      ->where('messages.created_at', '>', $readAt)
      ->count();
    $firstUnreadMessageId = $dialog->messages()
      ->where(fn($senderQuery) => $senderQuery
        ->whereNull('messages.sender_id')
        ->orWhere('messages.sender_id', '!=', $me->id))
      ->where('messages.created_at', '>', $readAt)
      ->orderBy('messages.created_at')
      ->orderBy('messages.id')
      ->value('messages.id');
    $hasReminder = $this->hasReminderAfter($dialog, $me, $readAt);

    return response()->json([
      'ok' => true,
      'counter' => $counter,
      'first_unread_message_id' => $firstUnreadMessageId,
      'has_reminder' => $hasReminder,
      'last_read_at' => $readAt->toJSON(),
    ]);
  }

  private function updatePivotFlag(Request $request, string $target, string $column): JsonResponse {
    $me = $request->user();

    $validated = $request->validate([
      $column => ['sometimes', 'boolean'],
    ]);

    $dialog = $this->findDialogByTarget($me, $target);

    if (!$dialog) {
      if ($column === 'muted') {
        $dialog = $this->channelPreviewDialog($target);

        if ($dialog) {
          $value = array_key_exists($column, $validated)
            ? (bool)$validated[$column]
            : true;
          $dialog->users()->attach($me->id, [
            'role' => DialogMemberRole::MEMBER->value,
            'permissions' => null,
            'muted' => $value,
            'archived' => false,
            'last_read_at' => $dialog->messages()->max('created_at'),
          ]);

          return response()->json([
            'ok' => true,
            $column => $value,
          ]);
        }
      }

      return response()->json([
        'ok' => false,
        'message' => 'Dialog not found',
      ], 404);
    }

    $value = array_key_exists($column, $validated)
      ? (bool)$validated[$column]
      : !(bool)$dialog->pivot->{$column};

    $me->dialogs()->updateExistingPivot($dialog->id, [
      $column => $value,
    ]);

    return response()->json([
      'ok' => true,
      $column => $value,
    ]);
  }

  private function dialogsQuery(User $me): BelongsToMany {
    return $me->dialogs()
      ->select(Dialog::columns())
      ->selectSub(
        Message::query()
          ->select('messages.id')
          ->whereColumn('messages.dialog_id', 'dialogs.id')
          ->where(fn($senderQuery) => $senderQuery
            ->whereNull('messages.sender_id')
            ->orWhere('messages.sender_id', '!=', $me->id))
          ->where(fn($readQuery) => $readQuery
            ->whereNull('dialog_user.last_read_at')
            ->orWhereColumn('messages.created_at', '>', 'dialog_user.last_read_at'))
          ->orderBy('messages.created_at')
          ->orderBy('messages.id')
          ->limit(1),
        'first_unread_message_id'
      )
      ->selectSub($this->reminderQuery($me), 'has_reminder')
      ->withPivot(['role', 'permissions', 'muted', 'pinned', 'archived', 'last_read_at'])
      ->withCount(['messages as counter' => fn($query) => $query
        ->where(fn($senderQuery) => $senderQuery
          ->whereNull('messages.sender_id')
          ->orWhere('messages.sender_id', '!=', $me->id))
        ->where(fn($readQuery) => $readQuery
          ->whereNull('dialog_user.last_read_at')
          ->orWhereColumn('messages.created_at', '>', 'dialog_user.last_read_at'))])
      ->withLastMessage()
      ->with(['users' => fn($query) => $query
        ->select('users.id', 'first_name', 'last_name', 'bio', 'email', 'username', 'birth_date', 'avatar')
        ->withLastSeenAt()])
      ->withCount('users')
      ->orderedByActivity();
  }

  private function reminderQuery(User $me) {
    $userId = trim((string)$me->id);

    if ($userId === '') {
      return Message::query()->selectRaw('NULL');
    }

    $query = Message::query()
      ->selectRaw('1')
      ->whereColumn('messages.dialog_id', 'dialogs.id')
      ->where(fn($senderQuery) => $senderQuery
        ->whereNull('messages.sender_id')
        ->orWhere('messages.sender_id', '!=', $me->id))
      ->where(fn($readQuery) => $readQuery
        ->whereNull('dialog_user.last_read_at')
        ->orWhereColumn('messages.created_at', '>', 'dialog_user.last_read_at'));

    $this->applyReminderMentionFilter($query, $userId);

    return $query
      ->limit(1);
  }

  private function hasReminderAfter(Dialog $dialog, User $me, Carbon $readAt): bool {
    $userId = trim((string)$me->id);

    if ($userId === '') {
      return false;
    }

    $query = $dialog->messages()
      ->where(fn($senderQuery) => $senderQuery
        ->whereNull('messages.sender_id')
        ->orWhere('messages.sender_id', '!=', $me->id))
      ->where('messages.created_at', '>', $readAt);

    $this->applyReminderMentionFilter($query, $userId);

    return $query->exists();
  }

  private function applyReminderMentionFilter($query, string $userId): void {
    $escapedUserId = addcslashes($userId, '\%_');

    $query->where(fn($mentionQuery) => $mentionQuery
      ->where('messages.message', 'like', '%[@ id="' . $escapedUserId . '"%')
      ->orWhere('messages.message', 'like', "%[@ id='" . $escapedUserId . "'%")
      ->orWhere('messages.message', 'like', '%data-id="' . $escapedUserId . '"%')
      ->orWhere('messages.message', 'like', "%data-id='" . $escapedUserId . "'%"));
  }

  private function findDialogByTarget(User $me, string $target): ?Dialog {
    return $this->dialogsQuery($me)
      ->where(fn($query) => $this->applyDialogTargetFilter($query, $target, $me))
      ->first();
  }

  private function findReadableDialogByTarget(User $me, string $target): ?Dialog {
    return $this->findDialogByTarget($me, $target) ?? $this->channelPreviewDialog($target);
  }

  private function findDialogMembershipByTarget(User $me, string $target): ?Dialog {
    return $me->dialogs()
      ->select(Dialog::columns())
      ->withPivot(['role', 'permissions', 'muted', 'pinned', 'archived', 'last_read_at'])
      ->where(fn($query) => $this->applyDialogTargetFilter($query, $target, $me))
      ->first();
  }

  private function applyDialogTargetFilter($query, string $target, User $me): void {
    $parts = Dialog::parseDialogId($target);

    if (!$parts) {
      $targetUser = User::query()
        ->select(['id'])
        ->where('username', $target)
        ->first();

      if (!$targetUser) {
        $query->whereRaw('1 = 0');

        return;
      }

      $query
        ->where('dialogs.type', DialogType::DIRECT);

      if ($targetUser->id === $me->id) {
        $query->whereDoesntHave('users', fn($userQuery) => $userQuery
          ->where('users.id', '!=', $me->id));

        return;
      }

      $query->whereHas('users', fn($userQuery) => $userQuery
        ->where('users.id', '!=', $me->id)
        ->where('users.id', $targetUser->id));

      return;
    }

    $query->where('dialogs.type', $parts['type']);

    if ($parts['type'] === DialogType::DIRECT->value && $parts['id'] === $me->id) {
      $query->where(fn($directQuery) => $directQuery
        ->where('dialogs.id', $parts['id'])
        ->orWhereDoesntHave('users', fn($userQuery) => $userQuery
          ->where('users.id', '!=', $me->id)));

      return;
    }

    if ($parts['type'] === DialogType::DIRECT->value) {
      $query->where(fn($directQuery) => $directQuery
        ->where('dialogs.id', $parts['id'])
        ->orWhereHas('users', fn($userQuery) => $userQuery
          ->where('users.id', '!=', $me->id)
          ->where('users.id', $parts['id'])));

      return;
    }

    $query->where('dialogs.id', $parts['id']);
  }

  private function previewDialog(User $me, string $target): ?Dialog {
    $parts = Dialog::parseDialogId($target);

    if (!$parts) {
      return $this->directPreviewDialogByUsername($me, $target);
    }

    return match ($parts['type']) {
      DialogType::DIRECT->value => $this->directPreviewDialog($me, $parts['id']),
      DialogType::CHANNEL->value => $this->channelPreviewDialog($target),
      default => null,
    };
  }

  private function directPreviewDialogByUsername(User $me, string $username): ?Dialog {
    $user = User::query()
      ->select(['id'])
      ->where('username', $username)
      ->first();

    if (!$user) {
      return null;
    }

    return $this->directPreviewDialog($me, $user->id);
  }

  private function directPreviewDialog(User $me, string $id): ?Dialog {
    $user = User::query()
      ->withLastSeenAt()
      ->select(['id', 'first_name', 'last_name', 'bio', 'email', 'username', 'birth_date', 'avatar'])
      ->where('id', $id)
      ->first();

    if (!$user) {
      return null;
    }

    $dialog = new Dialog([
      'author_id' => null,
      'title' => $user->name,
      'description' => null,
      'avatar' => $user->avatar,
      'type' => DialogType::DIRECT,
    ]);

    $dialog->setAttribute('id', $user->id);
    $dialog->setAttribute('users_count', $user->id === $me->id ? 1 : 2);
    $dialog->setRelation('users', $user->id === $me->id ? collect([$me]) : collect([$me, $user]));
    $dialog->setRelation('message', null);

    return $dialog;
  }

  private function channelPreviewDialog(string $dialogId): ?Dialog {
    return Dialog::query()
      ->select(Dialog::columns())
      ->wherePublicDialogId($dialogId)
      ->where('dialogs.type', DialogType::CHANNEL)
      ->withCount('users')
      ->first();
  }

  private function commonGroups(Dialog $dialog, User $me) {
    if ($dialog->type !== DialogType::DIRECT || !$dialog->relationLoaded('users')) {
      return collect();
    }

    $profileUser = $dialog->users->firstWhere('id', '!=', $me->id)
      ?? $dialog->users->firstWhere('id', $me->id);

    if (!$profileUser) {
      return collect();
    }

    return Dialog::query()
      ->select(Dialog::columns())
      ->where('dialogs.type', DialogType::GROUP)
      ->whereHas('users', fn($query) => $query->where('users.id', $me->id))
      ->whereHas('users', fn($query) => $query->where('users.id', $profileUser->id))
      ->withCount('users')
      ->orderBy('dialogs.title')
      ->get();
  }
}
