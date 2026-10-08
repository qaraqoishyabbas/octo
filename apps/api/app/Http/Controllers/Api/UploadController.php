<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TemporaryUpload;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class UploadController extends Controller {
  private const EXTENSION_MIME_TYPES = [
    'jpg' => 'image/jpeg',
    'jpeg' => 'image/jpeg',
    'png' => 'image/png',
    'gif' => 'image/gif',
    'webp' => 'image/webp',
    'avif' => 'image/avif',
    'heic' => 'image/heic',
    'heif' => 'image/heif',
    'mp4' => 'video/mp4',
    'm4v' => 'video/x-m4v',
    'mov' => 'video/quicktime',
    'webm' => 'video/webm',
    'mkv' => 'video/x-matroska',
    'avi' => 'video/x-msvideo',
    'mpeg' => 'video/mpeg',
    'mpg' => 'video/mpeg',
    '3gp' => 'video/3gpp',
    '3g2' => 'video/3gpp2',
  ];

  public function image(Request $request): JsonResponse {
    $entity = (string)$request->input('entity');
    $maxSizeKb = $this->maxSizeKb($entity);
    $maxSizeLabel = $this->formatMaxSize($maxSizeKb);

    $validated = $request->validate([
      'image' => ['nullable', 'file', 'max:' . $maxSizeKb],
      'file' => ['nullable', 'file', 'max:' . $maxSizeKb],
      'entity' => ['required', 'string', 'in:avatars,messages'],
      'width' => 'nullable|integer|min:1|max:1920',
      'height' => 'nullable|integer|min:1|max:1920',
    ], [
      'image.max' => "Файл не должен быть больше {$maxSizeLabel}.",
      'file.max' => "Файл не должен быть больше {$maxSizeLabel}.",
      'image.uploaded' => 'Не удалось загрузить файл. Проверьте размер файла и настройки загрузки PHP.',
      'file.uploaded' => 'Не удалось загрузить файл. Проверьте размер файла и настройки загрузки PHP.',
    ]);

    $file = $request->file('file') ?? $request->file('image');

    if (!$file instanceof UploadedFile) {
      throw ValidationException::withMessages([
        'file' => __('validation.required', ['attribute' => 'file']),
      ]);
    }

    if ($validated['entity'] === 'messages') {
      return $this->messageFile($request, $file);
    }

    if (!Str::startsWith($this->detectMimeType($file), 'image/')) {
      throw ValidationException::withMessages([
        'image' => __('validation.image', ['attribute' => 'image']),
      ]);
    }

    $extension = 'webp';

    $path = $file
      ->convert($request->width, $request->height, $extension)
      ->storeAs(
        $request->entity,
        implode('.', [(string)Str::uuid7(), $extension]),
        ['disk' => 'public']
      );

    $upload = TemporaryUpload::create([
      'user_id' => $request->user()?->id,
      'path' => $path,
      'type' => 'image',
      'mime_type' => 'image/webp',
      'original_name' => $file->getClientOriginalName(),
      'size' => $file->getSize() ?: 0,
    ]);

    return response()->json([
      'ok' => true,
      'id' => $upload->id,
      'path' => $path,
    ]);
  }

  public function destroy(Request $request, TemporaryUpload $upload): JsonResponse {
    if ($upload->user_id !== null && (string)$upload->user_id !== (string)$request->user()->id) {
      return response()->json([
        'ok' => false,
        'message' => 'Forbidden',
      ], 403);
    }

    Storage::disk('public')->delete(array_filter([
      $upload->path,
      $upload->thumbnail_path,
    ]));
    $upload->delete();

    return response()->json([
      'ok' => true,
    ]);
  }

  private function messageFile(Request $request, UploadedFile $file): JsonResponse {
    $validated = $request->validate([
      'type' => ['required', 'string', 'in:media,file'],
    ]);

    $extension = Str::lower($file->getClientOriginalExtension() ?: $file->extension() ?: 'bin');
    $mimeType = $this->detectMimeType($file, $extension);
    $type = $validated['type'];

    if ($type === 'media' && !$this->isMediaMimeType($mimeType)) {
      throw ValidationException::withMessages([
        'file' => 'Выберите фото или видео.',
      ]);
    }

    $path = $file->storeAs(
      'messages/' . now()->format('Y/m'),
      implode('.', [(string)Str::uuid7(), $extension]),
      ['disk' => 'public'],
    );

    [$width, $height] = $this->imageSize($file, $mimeType);

    $upload = TemporaryUpload::query()->create([
      'user_id' => $request->user()?->id,
      'path' => $path,
      'type' => $type,
      'mime_type' => $mimeType,
      'original_name' => $file->getClientOriginalName(),
      'size' => $file->getSize() ?: 0,
      'width' => $width,
      'height' => $height,
      'duration' => null,
      'thumbnail_path' => null,
    ]);

    return response()->json([
      'ok' => true,
      'id' => $upload->id,
      'path' => $upload->path,
      'type' => $upload->type,
      'mime_type' => $upload->mime_type,
      'original_name' => $upload->original_name,
      'size' => $upload->size,
      'width' => $upload->width,
      'height' => $upload->height,
      'duration' => $upload->duration,
      'thumbnail_path' => $upload->thumbnail_path,
    ]);
  }

  private function isMediaMimeType(string $mimeType): bool {
    return Str::startsWith($mimeType, 'image/') || Str::startsWith($mimeType, 'video/');
  }

  private function detectMimeType(UploadedFile $file, ?string $extension = null): string {
    $mimeType = (string)$file->getMimeType();

    if ($this->isMediaMimeType($mimeType)) {
      return $mimeType;
    }

    $extension = Str::lower($extension ?: $file->getClientOriginalExtension() ?: $file->extension() ?: '');

    return self::EXTENSION_MIME_TYPES[$extension] ?? $mimeType;
  }

  private function imageSize(UploadedFile $file, string $mimeType): array {
    if (!Str::startsWith($mimeType, 'image/')) {
      return [null, null];
    }

    $size = @getimagesize($file->path());

    return [
      $size[0] ?? null,
      $size[1] ?? null,
    ];
  }

  private function maxSizeKb(string $entity): int {
    $maxSizeMb = (int)config($entity === 'avatars' ? 'upload.avatar_max_mb' : 'upload.message_max_mb');

    return $maxSizeMb * 1024;
  }

  private function formatMaxSize(int $sizeKb): string {
    if ($sizeKb >= 1024 && $sizeKb % 1024 === 0) {
      return ($sizeKb / 1024) . ' МБ';
    }

    return $sizeKb . ' КБ';
  }
}
