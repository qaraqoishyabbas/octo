<?php

namespace App\Http\Controllers\Api;

use App\Enums\DialogType;
use App\Http\Controllers\Controller;
use App\Models\MessageAttachment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class MessageAttachmentController extends Controller {
  public function download(Request $request, string $attachment): JsonResponse|StreamedResponse {
    $file = MessageAttachment::query()
      ->whereKey($attachment)
      ->whereHas('message')
      ->whereHas('dialog', fn($query) => $query
        ->where('dialogs.type', DialogType::CHANNEL)
        ->orWhereHas('users', fn($userQuery) => $userQuery->where('users.id', $request->user()->id)))
      ->first();

    if (!$file) {
      return response()->json([
        'ok' => false,
        'message' => 'Attachment not found',
      ], 404);
    }

    $disk = Storage::disk('public');

    if (!$disk->exists($file->path)) {
      return response()->json([
        'ok' => false,
        'message' => 'File not found',
      ], 404);
    }

    return $disk->download($file->path, $file->original_name ?: 'file', [
      'Content-Type' => $file->mime_type ?: 'application/octet-stream',
    ]);
  }
}
