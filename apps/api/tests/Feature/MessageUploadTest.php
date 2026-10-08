<?php

namespace Tests\Feature;

use App\Models\TemporaryUpload;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class MessageUploadTest extends TestCase {
  use RefreshDatabase;

  public function test_user_can_upload_image_as_file(): void {
    Storage::fake('public');

    $user = User::factory()->create();

    $this
      ->withToken($user->createToken('Test device')->plainTextToken)
      ->post('/api/v1/upload', [
        'entity' => 'messages',
        'type' => 'file',
        'file' => UploadedFile::fake()->create('photo.jpg', 64, 'image/jpeg'),
      ])
      ->assertOk()
      ->assertJsonPath('ok', true)
      ->assertJsonStructure(['id'])
      ->assertJsonPath('type', 'file')
      ->assertJsonPath('mime_type', 'image/jpeg');

    $this->assertDatabaseHas('temporary_uploads', [
      'user_id' => $user->id,
      'type' => 'file',
      'mime_type' => 'image/jpeg',
      'original_name' => 'photo.jpg',
    ]);
  }

  public function test_media_upload_rejects_non_media_file(): void {
    Storage::fake('public');

    $user = User::factory()->create();

    $this
      ->withToken($user->createToken('Test device')->plainTextToken)
      ->post('/api/v1/upload', [
        'entity' => 'messages',
        'type' => 'media',
        'file' => UploadedFile::fake()->create('document.pdf', 64, 'application/pdf'),
      ])
      ->assertUnprocessable()
      ->assertJsonPath('errors.0.name', 'file');
  }

  public function test_media_upload_accepts_video_extension_when_mime_type_is_generic(): void {
    Storage::fake('public');

    $user = User::factory()->create();

    $this
      ->withToken($user->createToken('Test device')->plainTextToken)
      ->post('/api/v1/upload', [
        'entity' => 'messages',
        'type' => 'media',
        'file' => UploadedFile::fake()->create('clip.mkv', 64, 'application/octet-stream'),
      ])
      ->assertOk()
      ->assertJsonPath('ok', true)
      ->assertJsonPath('type', 'media')
      ->assertJsonPath('mime_type', 'video/x-matroska');
  }

  public function test_message_upload_rejects_files_over_one_hundred_megabytes(): void {
    Storage::fake('public');

    $user = User::factory()->create();

    $this
      ->withToken($user->createToken('Test device')->plainTextToken)
      ->post('/api/v1/upload', [
        'entity' => 'messages',
        'type' => 'media',
        'file' => UploadedFile::fake()->create('large.mp4', 102401, 'video/mp4'),
      ])
      ->assertUnprocessable()
      ->assertJsonPath('errors.0.name', 'file');
  }

  public function test_user_can_delete_own_temporary_upload(): void {
    Storage::fake('public');

    $user = User::factory()->create();
    Storage::disk('public')->put('messages/temp-file.txt', 'temporary');

    $upload = TemporaryUpload::query()->create([
      'user_id' => $user->id,
      'path' => 'messages/temp-file.txt',
      'type' => 'file',
      'mime_type' => 'text/plain',
      'original_name' => 'temp-file.txt',
      'size' => 9,
    ]);

    $this
      ->withToken($user->createToken('Test device')->plainTextToken)
      ->delete("/api/v1/upload/{$upload->id}")
      ->assertOk()
      ->assertJsonPath('ok', true);

    Storage::disk('public')->assertMissing('messages/temp-file.txt');
    $this->assertDatabaseMissing('temporary_uploads', [
      'id' => $upload->id,
    ]);
  }

  public function test_user_cannot_delete_another_users_temporary_upload(): void {
    Storage::fake('public');

    $owner = User::factory()->create();
    $user = User::factory()->create();

    $upload = TemporaryUpload::query()->create([
      'user_id' => $owner->id,
      'path' => 'messages/temp-file.txt',
      'type' => 'file',
      'mime_type' => 'text/plain',
      'original_name' => 'temp-file.txt',
      'size' => 9,
    ]);

    $this
      ->withToken($user->createToken('Test device')->plainTextToken)
      ->delete("/api/v1/upload/{$upload->id}")
      ->assertForbidden();

    $this->assertDatabaseHas('temporary_uploads', [
      'id' => $upload->id,
    ]);
  }
}
