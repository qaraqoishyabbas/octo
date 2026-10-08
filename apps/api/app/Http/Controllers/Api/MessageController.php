<?php

namespace App\Http\Controllers\Api;

use App\Enums\DialogMemberRole;
use App\Enums\DialogPermission;
use App\Enums\DialogType;
use App\Http\Controllers\Controller;
use App\Models\Dialog;
use App\Models\Message;
use App\Models\TemporaryUpload;
use App\Models\User;
use App\Services\MessageLinkService;
use App\Services\MessagePushService;
use App\Support\DialogAccess;
use App\Support\DialogRealtime;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Pagination\Cursor;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class MessageController extends Controller {
  public function index(Request $request): JsonResponse {
    $perPage = 30;
    $cursorId = $request->query('cursor_id');
    $dialogId = $request->query('dialog_id', '');

    $dialog = $this->findDialog($request->user(), $dialogId);

    if (!$dialog) {
      return response()->json([
        'ok' => true,
        'data' => [],
        'older_cursor' => null,
        'newer_cursor' => null,
      ]);
    }

    $query = Message::query()
      ->with($this->messageRelations())
      ->where('dialog_id', $dialog->id);

    if ($cursorId) {
      $target = (clone $query)
        ->where('id', (string)$cursorId)
        ->first();

      if (!$target) {
        return response()->json([
          'ok' => true,
          'data' => [],
          'older_cursor' => null,
          'newer_cursor' => null,
        ]);
      }

      $olderLimit = (int)floor($perPage / 2);
      $newerLimit = $perPage - $olderLimit;

      $older = (clone $query)
        ->where(fn($olderQuery) => $olderQuery
          ->where('created_at', '<', $target->created_at)
          ->orWhere(fn($sameTimeQuery) => $sameTimeQuery
            ->where('created_at', $target->created_at)
            ->where('id', '<=', $target->id)))
        ->orderByDesc('created_at')
        ->orderByDesc('id')
        ->limit($olderLimit + 1)
        ->get();

      $newer = (clone $query)
        ->where(fn($newerQuery) => $newerQuery
          ->where('created_at', '>', $target->created_at)
          ->orWhere(fn($sameTimeQuery) => $sameTimeQuery
            ->where('created_at', $target->created_at)
            ->where('id', '>', $target->id)))
        ->orderBy('created_at')
        ->orderBy('id')
        ->limit($newerLimit + 1)
        ->get();

      $hasOlder = $older->count() > $olderLimit;
      $hasNewer = $newer->count() > $newerLimit;

      $olderClean = $older->slice(0, $olderLimit);
      $newerClean = $newer->slice(0, $newerLimit);

      $lastOlder = $olderClean->last();
      $firstNewer = $newerClean->last();
      $items = $olderClean->reverse()->concat($newerClean)->values();

      return response()->json([
        'ok' => true,
        'data' => $items,
        'older_cursor' => ($hasOlder && $lastOlder) ?
          (new Cursor(['created_at' => $lastOlder->created_at, 'id' => $lastOlder->id]))->encode() : null,
        'newer_cursor' => ($hasNewer && $firstNewer) ?
          (new Cursor(['created_at' => $firstNewer->created_at, 'id' => $firstNewer->id], false))->encode() : null,
      ]);
    }

    $paginator = (clone $query)
      ->orderByDesc('created_at')
      ->orderByDesc('id')
      ->cursorPaginate($perPage);
    $items = collect($paginator->items())->reverse()->values();

    return response()->json([
      'ok' => true,
      'data' => $items,
      'older_cursor' => $paginator->nextCursor()?->encode(),
      'newer_cursor' => $paginator->previousCursor()?->encode(),
    ]);
  }

  public function store(Request $request): JsonResponse {
    $maxFiles = (int)config('upload.message_max_files', 10);

    $validated = $request->validate([
      'dialog_id' => ['required', 'string'],
      'message' => ['nullable', 'string', 'max:4000'],
      'silent' => ['sometimes', 'boolean'],
      'reply_to_id' => ['nullable', 'string'],
      'attachments' => ['nullable', 'array', 'max:' . $maxFiles],
      'attachments.*' => ['required', 'string', 'exists:temporary_uploads,id'],
    ], [
      'attachments.max' => "Вы выбрали слишком много файлов. За один раз можно отправить до {$maxFiles} файлов.",
    ]);

    $messageText = trim((string)($validated['message'] ?? ''));
    $attachmentIds = collect($validated['attachments'] ?? [])
      ->map(fn($id) => (string)$id)
      ->unique()
      ->values();

    if ($messageText === '' && $attachmentIds->isEmpty()) {
      throw ValidationException::withMessages([
        'message' => __('validation.required', ['attribute' => 'message']),
      ]);
    }

    $dialog = $this->findOrCreateDialogForMessage($request->user(), $validated['dialog_id']);

    if (!$dialog) {
      return response()->json([
        'ok' => false,
        'message' => 'Dialog not found',
      ], 404);
    }

    if (!DialogAccess::allows($dialog, DialogPermission::SEND_MESSAGES)) {
      return response()->json([
        'ok' => false,
        'message' => 'Forbidden',
      ], 403);
    }

    $replyTo = null;
    if (!empty($validated['reply_to_id'])) {
      $replyTo = Message::query()
        ->where('dialog_id', $dialog->id)
        ->whereKey((string)$validated['reply_to_id'])
        ->first();

      if (!$replyTo) {
        throw ValidationException::withMessages([
          'reply_to_id' => 'Сообщение для ответа не найдено.',
        ]);
      }
    }

    $uploads = TemporaryUpload::query()
      ->whereIn('id', $attachmentIds)
      ->where(fn($query) => $query
        ->whereNull('user_id')
        ->orWhere('user_id', $request->user()->id))
      ->get()
      ->keyBy('id');

    if ($uploads->count() !== $attachmentIds->count()) {
      throw ValidationException::withMessages([
        'attachments' => 'Некоторые вложения не найдены.',
      ]);
    }

    $message = DB::transaction(function () use ($dialog, $request, $messageText, $replyTo, $attachmentIds, $uploads, $validated): Message {
      $message = Message::query()->create([
        'dialog_id' => $dialog->id,
        'sender_id' => $request->user()->id,
        'reply_to_id' => $replyTo?->id,
        'message' => $messageText,
        'silent' => (bool)($validated['silent'] ?? false),
      ]);

      foreach ($attachmentIds as $index => $attachmentId) {
        $upload = $uploads->get($attachmentId);
        $attachmentId = (string)Str::uuid7();
        $path = $this->moveMessageAttachmentFile($upload->path, $dialog->id, $request->user()->id);
        $thumbnailPath = $this->moveMessageAttachmentThumbnail($upload->thumbnail_path, $dialog->id, $request->user()->id);

        $message->attachments()->create([
          'id' => $attachmentId,
          'dialog_id' => $dialog->id,
          'uploader_id' => $request->user()->id,
          'type' => $upload->type,
          'mime_type' => $upload->mime_type,
          'original_name' => $upload->original_name,
          'path' => $path,
          'size' => $upload->size,
          'width' => $upload->width,
          'height' => $upload->height,
          'duration' => $upload->duration,
          'thumbnail_path' => $thumbnailPath,
          'sort_order' => $index,
        ]);
      }

      TemporaryUpload::query()->whereIn('id', $attachmentIds)->delete();

      return $message;
    });

    app(MessageLinkService::class)->sync($message, $messageText);
    $message->load($this->messageRelations());
    DialogRealtime::message('dialog.message.created', $dialog, $message);
    app(MessagePushService::class)->send($dialog, $message);

    return response()->json([
      'ok' => true,
      'data' => $message,
    ], 201);
  }

  public function search(Request $request): JsonResponse {
    $dialogId = trim((string)$request->query('dialog_id', ''));
    $search = trim((string)$request->query('q', ''));
    $limit = min(100, max(1, (int)$request->query('limit', 30)));

    if (mb_strlen($search) < 2) {
      return response()->json([
        'ok' => true,
        'data' => [],
        'total' => 0,
      ]);
    }

    $dialog = $this->findDialog($request->user(), $dialogId);

    if (!$dialog) {
      return response()->json([
        'ok' => true,
        'data' => [],
        'total' => 0,
      ]);
    }

    $messages = Message::query()
      ->with($this->messageRelations())
      ->where('dialog_id', $dialog->id)
      ->where('message', 'like', "%{$search}%")
      ->orderByDesc('created_at')
      ->orderByDesc('id')
      ->limit($limit)
      ->get()
      ->reverse()
      ->values();

    return response()->json([
      'ok' => true,
      'data' => $messages,
      'total' => $messages->count(),
    ]);
  }

  public function pinned(Request $request): JsonResponse {
    $dialogId = trim((string)$request->query('dialog_id', ''));
    $limit = min(100, max(1, (int)$request->query('limit', 50)));

    $dialog = $this->findDialog($request->user(), $dialogId);

    if (!$dialog) {
      return response()->json([
        'ok' => true,
        'data' => [],
        'total' => 0,
      ]);
    }

    $messages = Message::query()
      ->with($this->messageRelations())
      ->where('dialog_id', $dialog->id)
      ->whereNotNull('pinned_at')
      ->orderByDesc('pinned_at')
      ->orderByDesc('id')
      ->limit($limit)
      ->get();

    return response()->json([
      'ok' => true,
      'data' => $messages,
      'total' => $messages->count(),
    ]);
  }

  public function update(Request $request, Message $message): JsonResponse {
    $validated = $request->validate([
      'message' => ['present', 'nullable', 'string', 'max:4000'],
    ]);

    $dialog = $request->user()
      ->dialogs()
      ->select(Dialog::columns())
      ->where('dialogs.id', $message->dialog_id)
      ->first();

    if (!$dialog) {
      return response()->json([
        'ok' => false,
        'message' => 'Message not found',
      ], 404);
    }

    if ($message->sender_id === null || (string)$message->sender_id !== (string)$request->user()->id) {
      return response()->json([
        'ok' => false,
        'message' => 'Forbidden',
      ], 403);
    }

    $messageText = trim((string)($validated['message'] ?? ''));

    if ($messageText === '' && !$message->attachments()->exists()) {
      throw ValidationException::withMessages([
        'message' => __('validation.required', ['attribute' => 'message']),
      ]);
    }

    $message->update([
      'message' => $messageText,
    ]);

    app(MessageLinkService::class)->sync($message, $messageText);
    $message->load($this->messageRelations());
    DialogRealtime::message('dialog.message.updated', $dialog, $message);

    return response()->json([
      'ok' => true,
      'data' => $message,
    ]);
  }

  public function pin(Request $request, Message $message): JsonResponse {
    $dialog = $request->user()
      ->dialogs()
      ->select(Dialog::columns())
      ->withPivot(['role', 'permissions'])
      ->where('dialogs.id', $message->dialog_id)
      ->first();

    if (!$dialog) {
      return response()->json([
        'ok' => false,
        'message' => 'Message not found',
      ], 404);
    }

    if (!DialogAccess::allows($dialog, DialogPermission::PIN_MESSAGES)) {
      return response()->json([
        'ok' => false,
        'message' => 'Forbidden',
      ], 403);
    }

    $isPinned = $message->pinned_at !== null;
    $message->timestamps = false;
    $message->forceFill([
      'pinned_at' => $isPinned ? null : now(),
      'pinned_by_id' => $isPinned ? null : $request->user()->id,
    ])->save();
    $message->timestamps = true;

    $message->load($this->messageRelations());
    DialogRealtime::message('dialog.message.pinned', $dialog, $message);

    return response()->json([
      'ok' => true,
      'pinned' => !$isPinned,
      'data' => $message,
    ]);
  }

  public function destroy(Request $request, Message $message): JsonResponse {
    $dialog = $request->user()
      ->dialogs()
      ->select(Dialog::columns())
      ->withPivot(['role', 'permissions'])
      ->where('dialogs.id', $message->dialog_id)
      ->first();

    if (!$dialog) {
      return response()->json([
        'ok' => false,
        'message' => 'Message not found',
      ], 404);
    }

    $isSender = $message->sender_id !== null && (string)$message->sender_id === (string)$request->user()->id;
    $canModerate = DialogAccess::allows($dialog, DialogPermission::DELETE_MESSAGES);

    if (!$isSender && !$canModerate) {
      return response()->json([
        'ok' => false,
        'message' => 'Forbidden',
      ], 403);
    }

    $messageId = (string)$message->id;
    $message->delete();
    DialogRealtime::messageDeleted($dialog, $messageId);

    return response()->json([
      'ok' => true,
    ]);
  }

  private function moveMessageAttachmentFile(string $sourcePath, string $dialogId, string $senderId): string {
    $disk = Storage::disk('public');

    if (!$disk->exists($sourcePath)) {
      throw ValidationException::withMessages([
        'attachments' => 'Некоторые вложения не найдены.',
      ]);
    }

    $fileName = basename($sourcePath);
    $targetPath = "messages/{$dialogId}/{$senderId}/{$fileName}";

    if (!$disk->move($sourcePath, $targetPath)) {
      throw ValidationException::withMessages([
        'attachments' => 'Не удалось сохранить вложение.',
      ]);
    }

    return $targetPath;
  }

  private function moveMessageAttachmentThumbnail(?string $sourcePath, string $dialogId, string $senderId): ?string {
    if (!$sourcePath || !Storage::disk('public')->exists($sourcePath)) {
      return null;
    }

    return $this->moveMessageAttachmentFile($sourcePath, $dialogId, $senderId);
  }

  private function messageRelations(): array {
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

    return $query->first() ?? $this->findPublicChannel($dialogId);
  }

  private function findPublicChannel(string $dialogId): ?Dialog {
    $parts = Dialog::parseDialogId($dialogId);

    if (!$parts || $parts['type'] !== DialogType::CHANNEL->value) {
      return null;
    }

    return Dialog::query()
      ->select(Dialog::columns())
      ->where('dialogs.type', DialogType::CHANNEL)
      ->where('dialogs.id', $parts['id'])
      ->first();
  }

  private function findOrCreateDialogForMessage(User $me, string $dialogId): ?Dialog {
    $dialog = $this->findDialog($me, $dialogId) ?? $this->findPublicChannel($dialogId);

    if ($dialog) {
      return $dialog;
    }

    $parts = Dialog::parseDialogId($dialogId);

    if (!$parts || $parts['type'] !== DialogType::DIRECT->value) {
      return null;
    }

    $recipient = User::query()
      ->select(['id'])
      ->where('id', $parts['id'])
      ->first();

    if (!$recipient) {
      return null;
    }

    return DB::transaction(function () use ($me, $recipient): Dialog {
      $existing = $this->findDirectDialog($me, $recipient->id);

      if ($existing) {
        return $existing;
      }

      $dialog = Dialog::query()->create([
        'author_id' => $me->id,
        'title' => null,
        'description' => null,
        'avatar' => null,
        'type' => DialogType::DIRECT,
      ]);

      $members = [
        $me->id => [
          'role' => DialogMemberRole::MEMBER->value,
        ],
      ];

      if ($recipient->id !== $me->id) {
        $members[$recipient->id] = [
          'role' => DialogMemberRole::MEMBER->value,
        ];
      }

      $dialog->users()->sync($members);

      return $dialog;
    });
  }

  private function findDirectDialog(User $me, string $recipientId): ?Dialog {
    $query = $me->dialogs()
      ->select(Dialog::columns())
      ->where('dialogs.type', DialogType::DIRECT->value);

    if ($recipientId === $me->id) {
      return $query
        ->whereDoesntHave('users', fn($userQuery) => $userQuery
          ->where('users.id', '!=', $me->id))
        ->first();
    }

    return $query
      ->whereHas('users', fn($userQuery) => $userQuery
        ->where('users.id', '!=', $me->id)
        ->where('users.id', $recipientId))
      ->first();
  }
}
