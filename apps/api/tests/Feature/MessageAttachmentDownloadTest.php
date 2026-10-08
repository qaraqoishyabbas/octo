<?php

namespace Tests\Feature;

use App\Enums\DialogMemberRole;
use App\Enums\DialogType;
use App\Models\Dialog;
use App\Models\Message;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class MessageAttachmentDownloadTest extends TestCase {
  use RefreshDatabase;

  public function test_dialog_member_can_download_message_attachment(): void {
    Storage::fake('public');

    $user = User::factory()->create();
    $other = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::DIRECT,
    ]);
    $dialog->users()->sync([
      $user->id => ['role' => DialogMemberRole::MEMBER->value],
      $other->id => ['role' => DialogMemberRole::MEMBER->value],
    ]);
    $message = Message::factory()->create([
      'dialog_id' => $dialog->id,
      'sender_id' => $other->id,
    ]);
    Storage::disk('public')->put('messages/test.txt', 'download body');
    $attachment = $message->attachments()->create([
      'dialog_id' => $dialog->id,
      'uploader_id' => $other->id,
      'type' => 'file',
      'mime_type' => 'text/plain',
      'original_name' => 'test.txt',
      'path' => 'messages/test.txt',
      'size' => 13,
      'sort_order' => 0,
    ]);

    $this
      ->withToken($user->createToken('Test device')->plainTextToken)
      ->get("/api/v1/attachments/{$attachment->id}/download")
      ->assertOk()
      ->assertDownload('test.txt');
  }

  public function test_user_cannot_download_attachment_from_unrelated_dialog(): void {
    Storage::fake('public');

    $user = User::factory()->create();
    $other = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::GROUP,
    ]);
    $dialog->users()->sync([
      $other->id => ['role' => DialogMemberRole::MEMBER->value],
    ]);
    $message = Message::factory()->create([
      'dialog_id' => $dialog->id,
      'sender_id' => $other->id,
    ]);
    Storage::disk('public')->put('messages/secret.txt', 'secret');
    $attachment = $message->attachments()->create([
      'dialog_id' => $dialog->id,
      'uploader_id' => $other->id,
      'type' => 'file',
      'mime_type' => 'text/plain',
      'original_name' => 'secret.txt',
      'path' => 'messages/secret.txt',
      'size' => 6,
      'sort_order' => 0,
    ]);

    $this
      ->withToken($user->createToken('Test device')->plainTextToken)
      ->getJson("/api/v1/attachments/{$attachment->id}/download")
      ->assertNotFound()
      ->assertJsonPath('ok', false);
  }

  public function test_non_member_can_download_channel_attachment(): void {
    Storage::fake('public');

    $user = User::factory()->create();
    $owner = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::CHANNEL,
    ]);
    $dialog->users()->attach($owner->id, [
      'role' => DialogMemberRole::OWNER->value,
    ]);
    $message = Message::factory()->create([
      'dialog_id' => $dialog->id,
      'sender_id' => $owner->id,
    ]);
    Storage::disk('public')->put('messages/channel.txt', 'channel body');
    $attachment = $message->attachments()->create([
      'dialog_id' => $dialog->id,
      'uploader_id' => $owner->id,
      'type' => 'file',
      'mime_type' => 'text/plain',
      'original_name' => 'channel.txt',
      'path' => 'messages/channel.txt',
      'size' => 12,
      'sort_order' => 0,
    ]);

    $this
      ->withToken($user->createToken('Test device')->plainTextToken)
      ->get("/api/v1/attachments/{$attachment->id}/download")
      ->assertOk()
      ->assertDownload('channel.txt');
  }
}
